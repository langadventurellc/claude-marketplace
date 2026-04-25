---
name: create-pr
description: Commit (if needed), push (if needed), and open a GitHub pull request using the team PR template. Creates a *draft* PR by default. Use whenever the user asks to "create a PR", "open a pull request", "ship this", "file the PR", "PR this up", etc. Handles Jira/Trellis context auto-detection, halts on suspicious staged content (secrets, large binaries, scope creep, merge markers), and enforces the `{JIRA-ID}: {outcome}` title format. Supports `--no-draft` (create non-draft) and `--ai-review` (add `ai-review` label).
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
  - Write
  - Skill
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_atlassian_atlassian__getJiraIssue
---

# Create Pull Request

Collapse the usual commit → push → open-PR-with-template dance into one invocation. Draft PR by default. Enforces the team's title format (`{JIRA-ID}: {outcome}`) and PR body template. Halts before committing/pushing if the staged set looks suspicious.

## Configuration

Tenanty values (Jira project prefix, Atlassian base URL) are loaded from `${CLAUDE_PLUGIN_DATA}/_config.json` at the start of every run via the preflight step below. The path resolves at runtime and persists across plugin updates. Jira URL format is `<BASE_URL>/browse/<KEY>`.

Inline constants (not in the config file):

| Field | Value |
|---|---|
| Default draft state | `draft` |
| AI review label | `ai-review` (added only when `--ai-review` is passed) |

## Flags

Parse these from the invocation arguments before doing anything else:

| Flag | Effect |
|---|---|
| `--no-draft` | Create a non-draft PR. Default is draft. |
| `--ai-review` | Add the `ai-review` label on the PR after creation. |

Unknown flags → stop and ask the user what they meant via `AskUserQuestion`. Don't silently ignore.

## Workflow

Follow these steps in order. Each step's output is required for the next.

### 0. Preflight: load configuration

Before any other step, resolve the config path and load it.

1. Run `Bash`: `mkdir -p "${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/jira-issue-orchestration}" && echo "${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/jira-issue-orchestration}/_config.json"`. Bind the printed path to `CONFIG_PATH` for the rest of this run.
2. Use the `Read` tool on `CONFIG_PATH`. This skill needs: `atlassianBaseUrl`, `jiraProjectKey`.

If the file is missing, or any required key is absent/empty:

1. Use `AskUserQuestion` to collect the missing values from the user.
2. Use the `Write` tool to persist the merged config back to `CONFIG_PATH`. **Preserve any keys already present in the file** — merge, don't overwrite.
3. Use the collected values for the rest of this run.

Bind the resolved values to the local names `BASE_URL`, `PROJECT_KEY`.

### 1. Pre-flight: sanity-check the working tree

Fire all of these in parallel via `Bash`:

- `git status --porcelain=v1 -b` — branch name, ahead/behind, dirty state
- `git rev-parse --abbrev-ref HEAD` — current branch
- `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` — repo default branch
- `git log --oneline -20` — recent commits on this branch
- `git diff --stat` and `git diff --cached --stat` — unstaged and staged change summary

**Hard stops after step 1:**

- **Current branch is the repo default** (main/master/etc.) → stop. Emit: `Refusing to create a PR from the default branch ('<name>'). Switch to a feature branch first.` Do not offer to create a branch — that's a separate operation.
- **Not in a git repo / gh not authed** → surface the raw error and stop.

### 2. Halt-trigger scan on the pending change set

The "pending change set" = everything that will be in the PR: uncommitted changes (staged + unstaged) **plus** commits on this branch that aren't on the default branch yet. Get it via:

```
git diff <default-branch>...HEAD --name-only   # committed-but-unpushed/unmerged
git status --porcelain=v1                       # uncommitted
```

Scan the combined file list and (where relevant) the diff content for any of the following. If **any** trigger fires, **halt** and alert the user in-chat with what was found and where. Do not auto-commit, do not push. Wait for the user to either fix it, explicitly override (`"proceed anyway"` / `"it's fine"`), or cancel.

| Trigger | What to look for |
|---|---|
| **Secrets / credentials** | File names matching `.env*` (except `.env.example`, `.env.sample`), `*.pem`, `*.key`, `id_rsa*`, `credentials.json`, `*.p12`, `service-account*.json`. In diff content: lines matching `(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{16,}`, AWS key patterns (`AKIA[0-9A-Z]{16}`), private key headers (`-----BEGIN (RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----`). |
| **Large/binary/artifact files** | Paths under `node_modules/`, `dist/`, `build/`, `target/`, `out/`, `.next/`, `.cache/`, `coverage/`, `__pycache__/`, `*.pyc`, `*.class`, `*.jar`, `*.zip`, `*.tar.gz`, `*.dmg`, `*.exe`, `*.so`, `*.dylib`. Also: any single file >1MB in the diff (check with `git diff <base>...HEAD --stat` and `ls -l`). |
| **Scope creep / unrelated files** | Files whose paths don't plausibly relate to the Jira summary, branch name, or recent commit messages. This is a judgment call — only flag if it's *clearly* off-topic (e.g. branch is `CORE-1234-image-pipeline` but diff touches `billing/invoice_renderer.rb`). If unsure, don't flag. |
| **Merge conflict markers** | Any tracked file containing `<<<<<<<`, `=======` (on its own line between markers), or `>>>>>>>`. Use `git grep -nE '^(<<<<<<<\|=======\|>>>>>>>)' -- ':(exclude)*.md'` as a fast check. |

When halting, list each trigger with the file path and a one-line reason. Then stop. Example:

```
Pre-flight check found issues — stopping before commit/push:

  • Secret suspected in src/config/aws.ts:14 — "AWS_SECRET_ACCESS_KEY = AKIA..."
  • Unrelated file in change set: billing/invoice_renderer.rb (branch is CORE-1234-image-pipeline)

Fix these or confirm they're intentional before I continue.
```

### 3. Resolve Jira ID(s)

Run both sources in parallel and dedupe:

- **Branch name**: regex `\b(<PROJECT_KEY>-\d+)\b` (substitute `PROJECT_KEY` from step 0) against the current branch.
- **Commit messages**: same regex against `git log <default-branch>..HEAD --format=%B`.

Results:

- **Zero IDs found** → ask the user via `AskUserQuestion`: "No Jira ID detected in branch or commits. Provide one?" Options: `<best-guess if any>` / `No Jira ticket (skip)`. Auto-"Other" covers a freeform key.
- **Exactly one ID** → use it silently. No confirmation prompt — the user approves it implicitly when they approve the full draft in step 5 (the ID is in the title). Adding a second prompt here is redundant friction.
- **Multiple distinct IDs** → `AskUserQuestion` to pick the **primary** (goes in title + Jira ticket section). List up to 3 top candidates (branch-matched first, then most-recent-commit order) + `No Jira ticket`. All detected IDs still get linked in the PR body's Jira ticket section — primary first, others on following lines.

If the user passed `--jira <KEY>` or said "use CORE-5678" in the invocation, skip detection and use that directly.

### 4. Gather PR context

Fire the following in parallel; each is optional and degrades gracefully if empty/failing.

- **Primary Jira ticket**: call `mcp__plugin_atlassian_atlassian__getJiraIssue` directly with `cloudId` from `CONFIG_PATH` (`atlassianCloudId` — prompt and persist via the same merge logic as step 0 if missing) and `issueIdOrKey` set to the primary key from step 3. Use `responseContentFormat: "markdown"` for simpler parsing. (The `get-jira-issue` skill wraps this same MCP call — calling the MCP directly is one hop instead of two and avoids re-entering the skill machinery.) Use the returned summary + description to inform the PR's What/Why.
- **Trellis issues**: scan both **commit messages** and the **branch name** for Trellis issue IDs. Patterns: `\b[TPEF]-[a-f0-9]{6,}\b` (task/project/epic/feature) and `\b[TPEF]-[a-z0-9-]+\b` for human-readable slugs like `F-return-failed-job-status-on`. If a pattern matches, call `mcp__plugin_task-trellis-teams_task-trellis__get_issue` for each in parallel. If the branch name matches but no commit does, that's fine — still look it up. If no patterns match anywhere, skip silently.
- **Diff content**: `git diff <default-branch>...HEAD` (full patch, but cap to the first ~500 lines when reading — for summarization purposes only). Pair with `git log <default-branch>..HEAD --format="%h %s%n%b"` for commit messages and bodies.

If the Jira lookup fails (auth, 404, etc.), fall back to a plain link in the Jira ticket section and don't use Jira context for What/Why drafting. Mention the fallback in the final report.

### 5. Draft the title and body

#### Title

Format: `{JIRA-ID}: {one-line outcome-focused description}`

Rules (same spirit as `create-jira-ticket`):

- State the **outcome**, not the implementation steps. "Report failed status for stalled finalizer jobs" beats "Update status enum and add stall detector and update worker loop".
- Keep under ~70 characters (including the `CORE-####:` prefix — no space before the colon).
- Strong verb start: Add, Fix, Enable, Remove, Migrate, Expose, Prevent, Report, Restore.
- No comma-separated action lists ("Add X, update Y, and fix Z") — find the unifying intent.
- No trailing period.
- If no Jira ID was resolved, omit the prefix and the colon — just the outcome line.

#### Body

Use this template verbatim. Every section appears — use `N/A` for sections that legitimately don't apply. Keep each section tight; reviewers know the problem space.

```
## What

<Plain English prose describing what this PR accomplishes. Written to sound like a human dev wrote it — outcome-focused, minimal jargon, no implementation play-by-play. Length follows the change: a small PR gets a sentence; a bigger one gets a short paragraph. See the humanize step below — this text is passed through `planning:humanize-text` before emit.>

## Why

<The branch-level value this change delivers — what capability it adds, what class of problems it prevents, what contract it establishes. Answers "why do we want this whole branch?", not "why each implementation decision." Reference the triggering incident/ticket only as context, not as the answer. Also passed through `planning:humanize-text`.>

## Jira ticket

[<PRIMARY-KEY>](<BASE_URL>/browse/<PRIMARY-KEY>)
<additional detected keys on subsequent lines, same link format, one per line — omit entirely if none>

## Steps to Validate/Verify

<what the reviewer does locally to verify. Bullet list preferred. URLs, commands, seeds, env vars. If genuinely nothing beyond normal CI / code review, write "N/A — covered by automated tests and code review.">

## Additional Notes

<forward-looking info a reviewer/maintainer needs that isn't obvious from the diff — flags, deploy ordering, follow-ups, non-obvious runtime impacts. Write "N/A" if none.>
```

**Drafting rules:**

- **What is plain-English prose. No bullet list, no "Key changes" block.** Describe the outcome a reader gains from the PR landing. Length follows the change — a small PR gets a sentence; a bigger one gets a short paragraph. Implementation specifics (file paths, function names, flag names, tool-call identifiers) don't belong here unless leaving them out would mislead the reader.
- Build the What from the diff + commits. If a Jira/Trellis description is available, use it to confirm intent and adjust wording — but don't just paste the ticket.
- **Why answers "why this whole branch?", not "why each decision."** A specific incident, ticket, or failed job is usually the *reason this work got prioritized*, not the *reason the change is worth making*. Ask: what capability does this add, what class of problems does it prevent, what contract does it establish, or what risk does it remove? Don't rationalize individual implementation choices — that's what the diff is for. The triggering incident can be mentioned briefly for context. Ground the framing in Jira/Trellis context and commit bodies — don't fabricate strategic narrative, but don't stop at the surface event either.
- If Jira/Trellis context is unavailable, derive Why from commit bodies and the diff. If still bare, write a short Why grounded in what the code change enables (e.g. "Establishes a failure-reporting contract so upstream pollers can detect permanent failures instead of waiting on a status that will never change.").
- **Steps to Validate** only gets content when you can actually infer it (e.g. new API endpoint → `curl` example; new env var → mention setting it; new UI route → mention the URL). Don't fabricate steps.
- **Additional Notes** is for info a reviewer or future maintainer needs that isn't obvious from the diff — config flags required at deploy, env-var changes, deployment ordering, follow-up tickets, known divergences from similar code, non-obvious runtime impacts. It can also capture a technical specific dropped during the humanize step if a reviewer genuinely needs it — but don't re-add everything the humanizer removed; most PRs leave this section as `N/A`, same as most human-written ones do. **Never include development-process chronology** — no Trellis issue IDs/trees, no "wave N" references, no per-task scope adjustments, no narrative of what was decided during implementation. If a note would only make sense to someone who watched the PR get written, drop it.
- If a section would be padding, write `N/A`. Don't invent content.

#### Humanize What and Why

After drafting the initial What and Why, pass each through the `planning:humanize-text` skill via the `Skill` tool — one invocation per section, with a context hint identifying the surface:

- What: `planning:humanize-text` with the drafted What as input and a hint like `"PR description, what-section"`.
- Why: `planning:humanize-text` with the drafted Why as input and a hint like `"PR description, why-section"`.

Use each returned rewrite verbatim in the PR body. If the humanizer dropped a concrete technical specific (file path, flag name, exit code, config key) that a reviewer genuinely needs to understand the PR, add it to `Additional Notes` as a short line — do **not** re-add it to What or Why. Most of the time nothing needs to be carried over; that's the humanizer doing its job.

#### Show the draft to the user

Before committing or pushing, print the draft as normal assistant text so the user sees what's about to ship. Do **not** ask for approval — proceed directly to step 6 after printing. The user can edit the PR after creation via `gh pr edit` or the web UI.

Emit a single assistant text block containing:

```
**Title:** <title>

**Body:**
<full body verbatim>
```

Then continue to step 6.

### 6. Commit if needed

If `git status --porcelain` shows any modified/untracked/staged files, delegate to the `git:commit` skill to stage and commit. Do **not** run `git commit` or `git add` yourself.

If `git status` is clean, skip this step.

After `git:commit` returns, re-run `git status --porcelain` to verify the tree is clean. If it isn't (the skill bailed for some reason), surface the reason and stop.

### 7. Push if needed

Determine push need from the step-1 status. The `git status --porcelain=v1 -b` first line is the signal:

- **No upstream set** — `## <branch>` with no `...` separator: `git push -u origin <branch>`.
- **Up to date** — `## <branch>...origin/<branch>` with **no** `[ahead N]` **and no** `[behind N]` suffix at all. The absence of any bracketed suffix *is* the in-sync signal — skip push.
- **Ahead of upstream** — `## <branch>...origin/<branch> [ahead N]`: `git push`.
- **Behind upstream** — `## <branch>...origin/<branch> [behind N]`: stop and alert. `Branch is behind origin/<branch> by N commits. Pull/rebase locally before I open the PR.` Do not auto-pull.
- **Diverged** — `[ahead N, behind M]`: stop and alert. Do not force-push, do not rebase silently. Tell the user: `Branch has diverged from origin/<branch> (ahead N, behind M). Resolve locally before I open the PR.`

### 8. Create the PR

Construct the `gh pr create` command:

- `--title "<title from step 5>"`
- `--body "<body from step 5>"` — pass via a HEREDOC or `--body-file` to preserve formatting.
- `--base <default branch from step 1>`
- `--draft` unless `--no-draft` was passed.

Then, only if `--ai-review` was passed, run `gh pr edit <pr-number-or-url> --add-label ai-review` after creation. Keep it a separate call — bundling `--label` into `gh pr create` fails if the label doesn't exist on the repo yet, and the error is harder to recover from mid-flow.

If the label add fails (label doesn't exist, permission), report the PR URL and mention the label failure. Don't retry or auto-create the label.

### 9. Report back

Four lines, nothing more:

```
Opened <draft|PR> <url>
Title: <title>
Base: <default branch>
Labels: <ai-review if added, else "—">
```

Append a 5th line `Jira: <primary key>` if one was used, or omit if not. Append a 6th line noting any graceful fallbacks that happened (e.g. `Note: get-jira-issue failed (404) — body drafted from diff only.`).

Do not echo the body back — the user can click the URL.

### 10. Offer Slack announcement (non-draft only)

If `--no-draft` was passed (and the PR was actually created as non-draft in step 8), offer to announce the PR in the team Slack channel. Otherwise — draft PRs, or any failure path above — skip this step entirely.

Call `AskUserQuestion` with:

- Question: `Announce this PR in #team-core-services-inventory-chat?`
- Options:
  - `Yes, announce it (Recommended)` — invoke the `announce-pr` skill via the `Skill` tool with `--pr <url>`.
  - `No` — stop. No Slack message.

On "Yes", hand off to `announce-pr`. That skill drafts the message, re-confirms with the user, and posts. Do not draft the Slack message here — `announce-pr` owns its own template and confirmation flow.

If the user cancels inside `announce-pr`, that's fine — no cleanup needed.

## Examples

### Minimal happy path

**User:** `/create-pr` (on branch `CORE-1234-circuit-breaker-eprocess`, one commit `add circuit breaker around eProcess download`)

**You silently:**

1. Pre-flight clean, branch is not default.
2. No halt triggers.
3. `CORE-1234` detected in branch — single match, use silently (no confirmation prompt).
4. Fetch CORE-1234 via the Atlassian MCP (`getJiraIssue`).
5. Print title + body as assistant text.
6. Working tree clean, skip commit.
7. Push (branch has no upstream).
8. `gh pr create --draft --title "..." --body-file /tmp/pr-body.md --base main`.
9. Report.

**Output:**

```
Opened draft PR https://github.com/carsdotcom/inventory-svc/pull/4421
Title: CORE-1234: Prevent cascading timeouts during eProcess CDN flaps
Base: main
Labels: —
Jira: CORE-1234
```

### `--no-draft --ai-review` on dirty tree

**User:** `/create-pr --no-draft --ai-review`

**You silently:**

1. Pre-flight clean.
2. No halt triggers.
3. Jira ID resolved.
4. Context gathered.
5. Print title + body as assistant text.
6. Delegate to `git:commit` — new commit lands.
7. Push with `-u`.
8. `gh pr create --title ... --body-file ... --base main` (no `--draft`), then `gh pr edit <url> --add-label ai-review`.
9. Report.
10. Non-draft → `AskUserQuestion`: "Announce this PR in #team-core-services-inventory-chat?" — on Yes, hand off to the `announce-pr` skill with `--pr <url>`.

**Output:**

```
Opened PR https://github.com/carsdotcom/inventory-svc/pull/4422
Title: CORE-1234: Prevent cascading timeouts during eProcess CDN flaps
Base: main
Labels: ai-review
Jira: CORE-1234
```

### Halt on suspected secret

**User:** `/create-pr`

**You:**

```
Pre-flight check found issues — stopping before commit/push:

  • Secret suspected in src/config/aws.ts:14 — AWS access key pattern (AKIA...)

Remove or move this to env before I continue.
```

No commit, no push, no PR.

## Notes on behavior

- **Draft by default.** The team defaults to draft PRs so CI runs without pinging reviewers prematurely. Only pass `--no-draft` when the user explicitly wants it.
- **Non-draft PRs offer a Slack announcement.** After a successful `--no-draft` PR creation, the final step prompts to hand off to the `announce-pr` skill (which posts a short message to `#team-core-services-inventory-chat`). Draft PRs never trigger this offer — draft is the "don't page reviewers yet" signal.
- **Don't generate the commit message yourself.** `git:commit` handles it. Avoids two skills fighting over conventional-commit format.
- **Don't force-push.** Ever. If the branch has diverged, stop and let the user resolve.
- **Don't set reviewers, assignees, or labels** beyond `ai-review`. CODEOWNERS / team norms handle the rest.
- **One PR per invocation.** If the user wants multiple PRs (e.g. atomized branches), they should run the skill once per branch.
- **Respect overrides.** If the user says "skip the pre-flight check, just create it" or "use this title: ...", honor it. The halt triggers are a default, not a policy.
- **Keep the body short.** Padding is worse than `N/A`. Reviewers already have the diff.
