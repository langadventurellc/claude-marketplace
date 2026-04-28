---
name: create-pr
description: Commit (if needed), push (if needed), and open a GitHub pull request using the team PR template. Creates a *draft* PR by default. Use whenever the user asks to "create a PR", "open a pull request", "ship this", "file the PR", "PR this up", etc. Handles Jira/Trellis context auto-detection, halts on suspicious staged content (secrets, large binaries, scope creep, merge markers), and enforces the `{JIRA-ID}: {outcome}` title format. Supports `--no-draft` (create non-draft).
allowed-tools:
  - AskUserQuestion
  - Bash
  - Skill
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_atlassian_atlassian__getJiraIssue
---

# Create Pull Request

## Configuration

Tenancy values (Jira project prefix, Atlassian base URL, Atlassian cloud ID) are loaded via the `issue-orchestration` MCP server's `get-config` tool in step 0. Jira URL format is `<BASE_URL>/browse/<KEY>`.

## Flags

Parse from invocation arguments before doing anything else:

| Flag | Effect |
|---|---|
| `--no-draft` | Create a non-draft PR. Default is draft. |

## Workflow

Follow these steps in order. Each step's output is required for the next.

### 0. Preflight: load configuration

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config` with no arguments. Bind `BASE_URL` from `values.atlassianBaseUrl`, `PROJECT_KEY` from `values.jiraProjectKey`, and `CLOUD_ID` from `values.atlassianCloudId`. If any are missing or empty, stop: `Config missing or incomplete. Run /orchestrate-jira-issue first to set up configuration.`

```!
bash "${CLAUDE_PLUGIN_ROOT}/scripts/collect-pr-context.sh"
```

### 1. Pre-flight: sanity-check the working tree

Read the injected runtime context above. Default branch is in `## Default branch`. Branch name, ahead/behind status, dirty state, recent commits, and change summary are in `## Working tree status`, `## Recent commits`, `## Pending change summary`.

**Hard stop:** if the current branch is the repo default (main/master/etc.), stop. Emit: `Refusing to create a PR from the default branch ('<name>'). Switch to a feature branch first.` Do not offer to create a branch.

### 2. Halt-trigger scan on the pending change set

The "pending change set" = everything that will be in the PR: uncommitted changes (staged + unstaged) **plus** commits on this branch that aren't on the default branch yet. Read it from the injected `## Files in the PR's change set` section (which contains both `git diff $DEFAULT_BRANCH...HEAD --name-only` output and `git status --porcelain=v1` output).

Scan the combined file list and (where relevant) the diff content for any of the following. If **any** trigger fires, **halt** and alert the user in-chat with what was found and where. Do not auto-commit, do not push. Wait for the user to either fix it, explicitly override (`"proceed anyway"` / `"it's fine"`), or cancel.

| Trigger | What to look for |
|---|---|
| **Secrets / credentials** | File names matching `.env*` (except `.env.example`, `.env.sample`), `*.pem`, `*.key`, `id_rsa*`, `credentials.json`, `*.p12`, `service-account*.json`. In diff content: lines matching `(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{16,}`, AWS key patterns (`AKIA[0-9A-Z]{16}`), private key headers (`-----BEGIN (RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----`). |
| **Large/binary/artifact files** | Paths under `node_modules/`, `dist/`, `build/`, `target/`, `out/`, `.next/`, `.cache/`, `coverage/`, `__pycache__/`, `*.pyc`, `*.class`, `*.jar`, `*.zip`, `*.tar.gz`, `*.dmg`, `*.exe`, `*.so`, `*.dylib`. Also: any single file >1MB in the diff (check with `git diff <base>...HEAD --stat` and `ls -l`). |
| **Scope creep / unrelated files** | Files whose paths don't plausibly relate to the Jira summary, branch name, or recent commit messages. This is a judgment call — only flag if it's *clearly* off-topic (e.g. branch is `ACME-1234-image-pipeline` but diff touches `billing/invoice_renderer.rb`). If unsure, don't flag. |
| **Merge conflict markers** | Any tracked file containing `<<<<<<<`, `=======` (on its own line between markers), or `>>>>>>>`. Use `git grep -nE '^(<<<<<<<\|=======\|>>>>>>>)' -- ':(exclude)*.md'` as a fast check. |

When halting, list each trigger with the file path and a one-line reason. Then stop. Example:

```
Pre-flight check found issues — stopping before commit/push:

  • Secret suspected in src/config/aws.ts:14 — "AWS_SECRET_ACCESS_KEY = AKIA..."
  • Unrelated file in change set: billing/invoice_renderer.rb (branch is ACME-1234-image-pipeline)

Fix these or confirm they're intentional before I continue.
```

### 3. Resolve Jira ID(s)

Run both sources in parallel and dedupe:

- **Branch name**: regex `\b(<PROJECT_KEY>-\d+)\b` (substitute `PROJECT_KEY` from step 0) against the injected branch name (available in `## Working tree status`).
- **Commit messages**: same regex against the injected `## Commit messages with bodies` section.

Results:

- **Zero IDs found** → ask the user via `AskUserQuestion`: "No Jira ID detected in branch or commits. Provide one?" Options: `<best-guess if any>` / `No Jira ticket (skip)`. Auto-"Other" covers a freeform key.
- **Exactly one ID** → use it silently.
- **Multiple distinct IDs** → `AskUserQuestion` to pick the **primary** (goes in title + Jira ticket section). List up to 3 top candidates (branch-matched first, then most-recent-commit order) + `No Jira ticket`. All detected IDs still get linked in the PR body's Jira ticket section — primary first, others on following lines.

### 4. Gather PR context

Fire the following in parallel; each is optional and degrades gracefully if empty/failing.

- **Primary Jira ticket**: call `mcp__plugin_atlassian_atlassian__getJiraIssue` with `CLOUD_ID` (bound from `atlassianCloudId` in step 0) and `issueIdOrKey` set to the primary key from step 3. Use `responseContentFormat: "markdown"`. Use the returned summary + description to inform the PR's What/Why.
- **Trellis issues**: scan both the injected `## Commit messages with bodies` section and the injected branch name for Trellis issue IDs. Patterns: `\b[TPEF]-[a-f0-9]{6,}\b` (task/project/epic/feature) and `\b[TPEF]-[a-z0-9-]+\b` for human-readable slugs like `F-return-failed-job-status-on`. If a pattern matches, call `mcp__plugin_task-trellis-teams_task-trellis__get_issue` for each in parallel. If the branch name matches but no commit does, that's fine — still look it up. If no patterns match anywhere, skip silently.
- **Diff content**: read from the injected `## Full diff vs. default branch` section (capped at 500 lines with truncation marker) and `## Commit messages with bodies` section.

If the Jira lookup fails (auth, 404, etc.), fall back to a plain link in the Jira ticket section and don't use Jira context for What/Why drafting. Mention the fallback in the final report.

### 5. Draft the title and body

#### Title

Format: `{JIRA-ID}: {one-line outcome-focused description}`

Rules (same spirit as `create-jira-ticket`):

- State the **outcome**, not the implementation steps. "Report failed status for stalled finalizer jobs" beats "Update status enum and add stall detector and update worker loop".
- Keep under ~70 characters (including the `ACME-####:` prefix — no space before the colon).
- Strong verb start: Add, Fix, Enable, Remove, Migrate, Expose, Prevent, Report, Restore.
- No comma-separated action lists ("Add X, update Y, and fix Z") — find the unifying intent.
- No trailing period.
- If no Jira ID was resolved, omit the prefix and the colon — just the outcome line.

#### Body

Use this template verbatim. Every section appears — use `N/A` for sections that legitimately don't apply. Keep each section tight; reviewers know the problem space.

```!
bash "${CLAUDE_PLUGIN_ROOT}/scripts/load-pr-template.sh" "${CLAUDE_SKILL_DIR}/default-template.md"
```

**Drafting rules:**

- **What**: plain-English prose, outcome-focused. No bullets, no "Key changes" block. Length follows change size. Implementation specifics (file paths, function names, flags) don't belong unless omitting them would mislead. Build from diff + commits; use Jira/Trellis to confirm intent, not to paste from.
- **Why**: branch-level value (capability added, problem class prevented, contract established, risk removed) — not per-decision rationale. The triggering ticket or incident is *context*, not the answer. If Jira/Trellis context is unavailable, derive from commit bodies and the diff.
- **Steps to Validate**: only when you can actually infer it (new endpoint → `curl` example; new env var → mention setting it). Don't fabricate.
- **Additional Notes**: info a reviewer needs that isn't obvious from the diff — deploy flags, env vars, ordering, follow-ups, non-obvious runtime impacts. **Never include development-process chronology** (Trellis IDs/trees, "wave N", per-task scope adjustments, implementation narrative). Most PRs leave this `N/A`.
- If a section would be padding, write `N/A`.

#### Humanize What and Why

After drafting the initial What and Why, pass each through the `planning:humanize-text` skill via the `Skill` tool — one invocation per section, with a context hint identifying the surface:

- What: `planning:humanize-text` with the drafted What as input and a hint like `"PR description, what-section"`.
- Why: `planning:humanize-text` with the drafted Why as input and a hint like `"PR description, why-section"`.

Use each returned rewrite verbatim in the PR body. If the humanizer dropped a concrete technical specific (file path, flag name, exit code, config key) that a reviewer genuinely needs to understand the PR, add it to `Additional Notes` as a short line — do **not** re-add it to What or Why. Most of the time nothing needs to be carried over; that's the humanizer doing its job.

#### Show the draft to the user

Print the draft before committing/pushing so the user sees what's about to ship. Do not ask for approval — continue to step 6.

```
**Title:** <title>

**Body:**
<full body verbatim>
```

### 6. Commit if needed

If `git status --porcelain` shows any modified/untracked/staged files, delegate to the `git:commit` skill to stage and commit. Do **not** run `git commit` or `git add` yourself.

If `git status` is clean, skip this step.

After `git:commit` returns, re-run `git status --porcelain` to verify the tree is clean. If it isn't (the skill bailed for some reason), surface the reason and stop.

### 7. Push if needed

Re-run `git status --porcelain=v1 -b` via Bash before deciding push action — the snapshotted status from skill load is pre-commit and stale here. The first line is the signal:

- **No upstream set** — `## <branch>` with no `...` separator: `git push -u origin <branch>`.
- **Up to date** — `## <branch>...origin/<branch>` with no `[ahead N]` or `[behind N]` suffix: skip push.
- **Ahead of upstream** — `## <branch>...origin/<branch> [ahead N]`: `git push`.
- **Behind upstream** — `## <branch>...origin/<branch> [behind N]`: stop and alert. `Branch is behind origin/<branch> by N commits. Pull/rebase locally before I open the PR.` Do not auto-pull.
- **Diverged** — `[ahead N, behind M]`: stop and alert. Do not force-push, do not rebase silently. Tell the user: `Branch has diverged from origin/<branch> (ahead N, behind M). Resolve locally before I open the PR.`

### 8. Create the PR

Construct the `gh pr create` command:

- `--title "<title from step 5>"`
- `--body "<body from step 5>"` — pass via a HEREDOC or `--body-file` to preserve formatting.
- `--base <default branch from step 1>`
- `--draft` unless `--no-draft` was passed.

### 9. Report back

Three lines, nothing more:

```
Opened <draft|PR> <url>
Title: <title>
Base: <default branch>
```

Append a 4th line `Jira: <primary key>` if one was used.

Do not echo the body back — the user can click the URL.

## Notes on behavior

- **Don't set reviewers, assignees, or labels.** CODEOWNERS / team norms handle the rest.
- **Respect overrides.** If the user says "skip the halt-trigger scan, just create it" or "use this title: ...", honor it. The halt triggers are a default, not a policy.
