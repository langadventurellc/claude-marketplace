---
name: implement-trellis-issues
description: Orchestrates implementation of Trellis issues using Claude Code Agent Teams. The lead session resolves a scope, walks the issue tree, and spawns a fresh developer/reviewer pair per leaf task. Teammates communicate directly via SendMessage for review/fix cycles. Supports --commit and --docs flags. Recursive by default; unplanned non-leaf issues are skipped, never expanded. Use when asked to "implement feature", "implement trellis issues", "execute feature with teams", "implement tasks via agent teams", or whenever an agent-teams-based implementation run is desired.
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__claim_task
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__get_next_available_issue
  - mcp__plugin_task-trellis-teams_task-trellis__complete_task
  - mcp__plugin_task-trellis-teams_task-trellis__append_issue_log
  - mcp__plugin_task-trellis-teams_task-trellis__append_modified_files
  - mcp__plugin_task-trellis-teams_task-trellis__update_issue
  - mcp__plugin_task-trellis-teams_task-trellis__list_issues
  - TeamCreate
  - TeamDelete
  - Task
  - TaskCreate
  - TaskUpdate
  - TaskList
  - SendMessage
  - Skill
  - AskUserQuestion
  - Read
  - Grep
  - Glob
  - Bash
---

# Orchestrate Trellis Implementation via Agent Teams

Orchestrate the implementation of a Trellis scope (feature, epic, task, or next-available) using Claude Code's experimental **Agent Teams** feature. The lead session walks the issue tree, spawns a fresh developer/reviewer pair per leaf task, and lets those teammates coordinate review/fix cycles by direct `SendMessage`. On completion, optionally update docs and/or commit.

**This skill replaces the subagent-based `task-trellis:issue-implementation-orchestration` workflow with an agent-teams variant.** Key differences from the existing plugin:

- Developer and reviewer run as **teammates** inside an agent team and talk to each other directly via `SendMessage` instead of routing all feedback through the lead.
- A **fresh pair is spawned per leaf issue** and shut down on approval (no persistent developer or reviewer across issues).
- The **follow-up-work / issue-creation-during-implementation logic is removed**. Teammates and the lead NEVER create new Trellis issues during an implementation run. If an unplanned non-leaf issue is discovered, it is logged and skipped.

## Goal

Complete every planned leaf task under the given scope by:

1. Walking the issue tree under the scope and enumerating ready leaf tasks (respecting prerequisites and status).
2. For each ready task, spawning a fresh `trellis-developer` + `trellis-implementation-reviewer` pair and authoring two lead-owned task-list entries (impl task → review task with prerequisite).
3. Letting the pair coordinate implementation, review, and fix cycles via direct `SendMessage`.
4. Shutting down the pair on approval and moving to the next ready task.
5. Optionally updating documentation (`--docs`) and/or committing all changes in a single commit (`--commit`).

## Input

`$ARGUMENTS` format:

```
<scope> [--commit] [--docs]
```

- `<scope>` (optional): A Trellis issue ID. Accepts:
  - **Feature ID** (`F-xxx`) — recursively implements all its tasks (default behavior).
  - **Epic ID** (`E-xxx`) — recursively implements all tasks under all features under the epic.
  - **Project ID** (`P-xxx`) — recursively implements all tasks under all epics and features.
  - **Task ID** (`T-xxx`) — implements a single task.
  - **Empty** — lead calls `get_next_available_issue` (preferring `feature` type) to pick the next scope.
- `--commit` (optional flag): After all pairs finish (and `--docs` runs if set), the lead makes a single commit of all changes. Uses `/git:commit` skill if available, else falls back to `git add . && git commit -m "<message>"`.
- `--docs` (optional flag): After all pairs finish but **before** any commit, the lead spawns a `planning:planning-author` teammate to invoke `planning:docs-updater`. Docs updates are included in the commit when `--commit` is also set.

If neither flag is passed, the run leaves uncommitted changes for the user.

## Preflight

Scan `$ARGUMENTS` for `--commit` and `--docs` tokens and remove them from the scope argument. The remaining argument (if any) is the scope ID.

## Scope Resolution and Tree Walk

### 1. Resolve the starting issue

- If a scope ID was provided, call `get_issue` with that ID and confirm it exists.
- If no scope was provided, call `get_next_available_issue` with `issueType: "feature"`. If nothing is returned, fall back to `issueType: "task"`. If still nothing, STOP and report to the user that no available work exists.

### 2. Walk the tree to enumerate leaf tasks

Starting from the resolved scope, walk down recursively. At each node:

- **If the node is a leaf task (`type: "task"`):**
  - If status is `done` or `wont-do` → skip (log a brief note).
  - If status is `in-progress` → warn the user via `AskUserQuestion` ("Task X is already in-progress. Proceed anyway, skip, or stop?") and follow their direction.
  - Otherwise → add to the implementation candidate list.
- **If the node is a non-leaf (project/epic/feature):**
  - Use `list_issues` to enumerate its children.
  - **Unplanned-work rule (CRITICAL):** If the non-leaf node has **no children**, log the skip (`append_issue_log` on the issue with a short note), add it to the run's `skippedUnplanned` list, and continue to the next sibling. **NEVER create new issues under it.** The existing `task-trellis` follow-up-work logic is deliberately removed in this plugin.
  - Otherwise, recurse into each child.

Build the final implementation queue from the candidate list. Respect the prerequisite DAG: a candidate is **ready** only when all of its `prerequisites` are `done`. Other candidates **wait** until their prerequisites clear.

### 3. Feature branch creation

Run:

```bash
git branch --show-current
```

- **If on `main`:** Create and checkout a feature branch using the resolved scope ID:
  ```bash
  git checkout -b feature/<SCOPE_ID>
  ```
  Example: `feature/F-add-user-auth`. If the scope is a task, use the task ID.
- **If on any other branch:** Continue without branching.

## Team Creation

Create an agent team for this run. Use a short, scope-descriptive team name (e.g., `impl-F-add-user-auth`). The team lives for the duration of the run and is torn down at the end.

Team size: lead plus up to the maximum number of concurrent pairs you plan to run. Because each pair is two teammates, two concurrent pairs need four teammate slots plus the lead.

## Per-Issue Pair Lifecycle

For each ready leaf task in the queue, the lead executes this lifecycle. Multiple ready tasks may run in parallel (see "Parallelism" below).

### 1. Spawn a fresh pair

Spawn two teammates tied to this one task:

- A **developer** of agent type `task-trellis-teams:trellis-developer`.
- A **reviewer** of agent type `task-trellis-teams:trellis-implementation-reviewer`.

Give the pair distinguishable teammate names (e.g., `dev-T-add-login` and `rev-T-add-login`) so `SendMessage` routing is unambiguous. Tell each teammate at spawn the name of its pair partner so they can address each other directly.

#### Model selection

The `Task` tool accepts an optional `model` parameter at spawn time that takes precedence over the agent definition's frontmatter `model`. Use it as follows:

- **Developer (`trellis-developer`):** Default is `sonnet` (from the agent frontmatter). Before spawning, the lead assesses the task's complexity and passes `model: "opus"` at spawn time only when the task warrants it. Escalate to Opus when any of the following apply:
  - The task involves non-trivial architectural decisions, cross-cutting refactors, or subtle concurrency/state logic.
  - The task body, parent feature, or technical-discovery output flags it as complex, high-risk, or security-sensitive (auth, crypto, data migration, permissions).
  - The task has failed a prior implementation attempt and is being retried.
  - The task body is long or vague in a way that suggests the implementer will need significant reasoning to fill in gaps.

  Otherwise, omit `model` at spawn and let the Sonnet default apply. Bias toward Sonnet — Opus is the exception, not the default. Record the choice and the reason in an `append_issue_log` entry on the Trellis task so the decision is auditable.

- **Implementation reviewer (`trellis-implementation-reviewer`):** ALWAYS spawn with `model: "opus"`. Do NOT rely on frontmatter alone — pass `model: "opus"` at spawn time every time for clarity and to guard against future frontmatter drift. Opus is required here regardless of perceived task complexity; the reviewer's judgment is the last defense before the commit step and must not be degraded.

### 2. Author the two task-list entries (lead only)

The lead owns both entries. Initial instructions MUST come from the lead — never from another teammate. This preserves the bias guarantee (reviewer is not framed by developer's perspective, and vice versa).

**Impl task** (claimable by the developer immediately):

```
Title: Implement T-<task-id>

Body:
Implement Trellis task T-<task-id> (<task title>).

Parent feature: F-<feature-id> (<feature title>)

Workflow:
1. Read the task body via `mcp__plugin_task-trellis-teams_task-trellis__get_issue` for full requirements.
2. Follow the research-and-plan → clarify → implement → test workflow described in
   `task-trellis-teams:issue-implementation` (the SKILL.md file inside this plugin).
   If the `Skill` tool is unavailable to you as a teammate, open
   `plugins/task-trellis-teams/skills/issue-implementation/SKILL.md` directly and
   follow it.
3. Mark the Trellis task `done` via `complete_task` only after your own quality
   checks (tests, lint, type checks) pass.
4. Do NOT commit. Leave changes uncommitted for review.
5. Do NOT create new Trellis issues. If you hit a blocker that requires new work,
   message the lead directly.
6. When the task is done, send a content-free `SendMessage` activation nudge to
   your paired reviewer (<reviewer teammate name>).

Mark this task-list entry `done` when the implementation is complete and your
nudge has been sent.
```

**Review task** (prerequisite: the impl task; claimable only after impl is done):

```
Title: Review T-<task-id>

Body:
Review the implementation of Trellis task T-<task-id> (<task title>).

Parent feature: F-<feature-id> (<feature title>)

Workflow:
1. Follow `task-trellis-teams:issue-implementation-review` (SKILL.md in this plugin).
   If the `Skill` tool is unavailable, open
   `plugins/task-trellis-teams/skills/issue-implementation-review/SKILL.md` directly.
2. Review the uncommitted changes the developer produced for T-<task-id> for
   correctness, completeness, and simplicity.
3. If you have findings, send them as a single `SendMessage` to the paired
   developer (<developer teammate name>). Wait for the developer to notify you
   when fixes are ready, then re-review.
4. When there are no blocking findings, mark this task-list entry `done`.
5. Do NOT modify files. You are read-only.
6. Do NOT create new Trellis issues. If findings fall outside the scope of the
   current task, note them in your review message and let the lead decide.
```

Set the review task's dependency on the impl task using the two-step `TaskCreate` → `TaskUpdate` pattern. `TaskCreate` does not accept dependencies at creation time; create both tasks first (capturing their returned task IDs), then declare the dependency:

```
implTaskId = TaskCreate({ "subject": "impl-T-<task-id>", "description": "<impl task body above>" })
reviewTaskId = TaskCreate({ "subject": "review-T-<task-id>", "description": "<review task body above>" })

TaskUpdate({
  "taskId": reviewTaskId,
  "addBlockedBy": [implTaskId]
})
```

Persist the name→ID map for the run so you can reference these tasks in later updates (assigning owners via `TaskUpdate({ taskId, owner })`, marking completed via `TaskUpdate({ taskId, status: "completed" })`, etc.). `TaskUpdate` identifies tasks by `taskId`, not by subject.

This dependency blocks the review task-list entry until the impl entry is marked `completed`, so the reviewer cannot claim it early.

### 3. Pair executes autonomously

The lead does not intervene once the pair is running. Expected flow:

0. **Lead sends start nudge.** After authoring the two task-list entries for this pair (impl + review), the lead MUST send a content-free `SendMessage` to the developer:
   ```
   SendMessage({ to: "<developer-name>", summary: "begin assigned work", message: "begin assigned work" })
   ```
   The reviewer does not need a nudge — its task is blocked until the developer completes.
1. Developer claims the impl task-list entry and the Trellis task (`mcp__plugin_task-trellis-teams_task-trellis__claim_task`), implements, runs its own checks, marks the Trellis task done via `complete_task`, marks the impl task-list entry done, and sends a content-free `SendMessage` nudge to the reviewer.
2. Reviewer's task-list entry unblocks. Reviewer claims it, reviews the changes, and either:
   - **Approves:** Marks the review task-list entry done.
   - **Has findings:** `SendMessage` directly to the developer with findings. Does NOT mark the review task done.
3. Developer receives findings, fixes, then `SendMessage`s the reviewer when fixes are ready. Reviewer re-reviews. Repeat until approved.
4. Once the review task-list entry is marked done, the pair's work is complete.

### 4. Shut down the pair

When the review task-list entry is marked done (approval), the lead shuts down **both** teammates in the pair. A fresh pair will be spawned for the next ready task. This is a deliberate design choice:

- Prevents cross-task context bleed from one implementation into the next.
- Guarantees the bias guarantee holds per-issue (no reviewer carrying opinions forward).
- Keeps teammate context windows small.

### 5. Unblock next tasks

After a task's review is approved, re-evaluate the implementation queue: any task whose prerequisites are now all `done` becomes ready. Spawn fresh pairs for the newly-ready tasks (applying the parallelism rule below).

## Parallelism (informed judgment)

For every set of currently-ready tasks, decide whether to run them in parallel or serialize them based on an **informed judgment** about likely file overlap:

1. Read each ready task's body (`get_issue`) — specifically the description, technical approach, and acceptance criteria sections.
2. Ask yourself: **could these tasks plausibly modify the same files, or the same narrow area of the codebase?**
   - If yes, **serialize them** — run them one pair at a time, shutting the first down before spawning the next.
   - If no, or if you cannot tell, **run them in parallel** — spawn all their pairs concurrently.
3. Do NOT rely on `affectedFiles` / `modifiedFiles` metadata from Trellis issues for this decision. That metadata is populated **after** implementation and cannot inform pre-spawn scheduling.
4. Bias toward parallelism. Serial execution is the safe fallback when overlap is plausible, not the default.

Practical upper bound: do not run more than three or four pairs concurrently. Team size and teammate slots are finite; excessive concurrency creates coordination overhead and muddies `SendMessage` routing.

## Error Handling (lead-side)

<rules>
  <critical>The lead does NOT write or debug code. Code-level errors go back to the responsible developer teammate.</critical>
  <critical>If an infrastructure error occurs (permissions, missing tools, network), STOP immediately and ask the user via `AskUserQuestion` how to proceed.</critical>
  <critical>NEVER create new Trellis issues during an implementation run, regardless of what teammates report.</critical>
  <critical>NEVER work around errors by skipping steps, using alternative approaches, or ignoring validation failures.</critical>
</rules>

### Code errors (during implementation or review fix cycles)

If a developer teammate reports a failure (hook failure, test failure, lint error, compile error, runtime error in its own code), or a reviewer reports findings that require code changes:

- This is the normal review-cycle path. Teammates resolve it among themselves via `SendMessage`.
- The lead only intervenes if the pair stalls (see below).

### Pair stalls

If the same finding keeps returning, the developer disputes the reviewer, or the pair is otherwise stuck, the lead:

1. Uses `AskUserQuestion` to surface the dispute to the user with the facts.
2. Follows the user's decision: e.g., send a clarifying `SendMessage` to one or both teammates, shut them down, escalate, or abandon the task.

### Infrastructure errors

Permission denied, missing tools, network failures, git configuration issues, missing environment variables — STOP and `AskUserQuestion`. Do NOT attempt workarounds.

### Developer blockers (e.g., needs new scope)

If a developer sends a direct message to the lead saying "I can't complete T-xxx without additional planned work":

- **Do NOT create new Trellis issues.** The no-issue-creation rule is absolute during an implementation run.
- `append_issue_log` on the affected task with a short note describing the blocker.
- Use `AskUserQuestion` to surface the blocker to the user. Follow their direction — likely options are: shut the pair down and abort this task, mark it `wont-do`, or stop the run entirely.

## Completion Phase

When every task in the implementation queue is either `done`, `wont-do`, or skipped by user direction, and all pairs have been shut down:

### 1. Documentation (only if `--docs`)

Spawn a **single** `planning:planning-author` teammate with a lead-authored task-list entry:

```
Title: Update docs for <scope>

Body:
Invoke the `planning:docs-updater` skill to review and update documentation
(CLAUDE.md, README.md, docs/) based on the changes implemented under <scope>
in this branch.

If the `Skill` tool is unavailable to you as a teammate, open
`plugins/planning/skills/docs-updater/SKILL.md` directly and follow it.

Do NOT commit. The lead owns the commit step.
```

Wait for that teammate to mark the task-list entry done, then shut it down.

### 2. Commit (only if `--commit`)

Before invoking the commit, verify that all `complete_task`, `append_issue_log`, and `append_modified_files` calls from the run have already completed so the `.trellis/` state changes are staged alongside the code changes and included in the single commit.

Check whether `/git:commit` skill is available:

- **If available:** Invoke it via the `Skill` tool and let the skill author its own conventional-commit message:
  ```
  Skill(skill="git:commit")
  ```
- **If not available:** Fall back to manual commit:
  ```bash
  git add .
  git commit -m "feat: implement <scope-id> - <scope-title>"
  ```
  Do NOT pass `--no-verify` and do NOT skip hooks. Do NOT force-push or touch remotes.

**Handling commit-hook failures:** If the commit fails due to a pre-commit or commit-msg hook complaining about code the developer wrote (tests, lint, type checks, format):

1. Identify which Trellis task's code caused the failure (inspect the hook output).
2. Spawn a fresh `trellis-developer` teammate for that task with a lead-authored task-list entry asking them to fix the hook error. (The original developer has already been shut down per the fresh-pair-per-issue rule.) Include the full hook output in the task body.

   **Intentional exception to the fresh-pair-per-issue rule:** spawn a lone developer here, NOT a new developer/reviewer pair. Rationale: the original review already approved the code on correctness/completeness/simplicity grounds; the fix is narrowly scoped to satisfying the commit hook (format/lint/type checks the hook surfaces) and does not warrant re-reviewing the full implementation. If the hook fix expands beyond that narrow scope, stop and `AskUserQuestion`.
3. Wait for the fix, shut that developer down, and re-attempt the commit.
4. Repeat until the commit succeeds.

**Do NOT debug hook failures from the lead.** The lead's role is to route the error back to a developer teammate.

If `--commit` is NOT set, leave all uncommitted changes for the user.

### 3. Team cleanup

**The lead owns team cleanup.** After the run completes (or is aborted by user direction):

1. Shut down every remaining teammate via `SendMessage({ to: "<teammate-name>", message: { type: "shutdown_request" } })` and wait for each `shutdown_response`. `TeamDelete` fails if any teammate is still running.
2. Tear down the agent team with `TeamDelete()` — takes no parameters; the team name comes from session context.

Teammates must not run cleanup themselves.

### 4. Summarize to the user

Produce a concise final message covering:

- **Scope** implemented (ID and title).
- **Tasks completed**, with counts (e.g., "5 tasks done, 1 skipped by user direction").
- **Skipped unplanned non-leaf issues** (list of IDs, one line each) — so the user can plan them if they choose.
- **Files affected at a high level** (areas of the codebase, not exhaustive file lists).
- **Docs updated** (yes/no).
- **Commit SHA** (if `--commit` ran) or a clear note that uncommitted changes remain.
- **How to verify** the changes (e.g., run the test suite, try the new CLI command, visit the endpoint).

## Important Constraints

- **Orchestration only.** The lead does NOT write or debug code. The lead spawns teammates, authors task-list entries, routes errors back to teammates, and commits approved changes. That is all.
- **Bias guarantee — initial instructions come from the lead only.** Every teammate receives its initial instructions from a lead-authored task-list entry. Teammates never pass initial instructions to each other. Direct `SendMessage` is only for (a) content-free activation nudges and (b) fix-cycle iteration after the initial unbiased instructions.
- **Fresh pair per issue.** Each leaf task gets its own developer and reviewer pair. Both teammates are shut down on approval. Nothing carries over to the next task.
- **No new Trellis issues.** The lead, developer, and reviewer NEVER create new Trellis issues during an implementation run. Unplanned work is logged and/or reported to the user at the end — not materialized as issues.
- **Unplanned non-leaf skip.** If a non-leaf issue has no children, skip it and continue to siblings. Never synthesize children for it.
- **Recursive by default.** A feature walks its tasks. An epic walks its features and their tasks. A project walks everything below it. There is no flag to disable recursion; a task-level scope is naturally a single item.
- **Informed-judgment parallelism.** Read ready task bodies; serialize tasks that might touch the same files. Do not rely on post-hoc metadata.
- **Team cleanup is the lead's responsibility.** Teammates never tear down the team.
- **Respect prerequisites.** Never spawn a pair for a task whose prerequisites are not `done`.
- **Single commit (only if `--commit`).** All implementation and docs changes go into one commit at the end. No commits between tasks.
- **No hook bypass.** When committing, do not use `--no-verify` or skip hooks. Fix the underlying issue via a developer teammate instead.
- **Stop for infrastructure errors.** Permission denied, missing tools, network issues → `AskUserQuestion` and follow user direction. Do not work around.

<rules>
  <critical>The lead NEVER writes or debugs code. Code errors go to the responsible developer teammate.</critical>
  <critical>The lead, developer, and reviewer NEVER create new Trellis issues during an implementation run.</critical>
  <critical>Non-leaf issues with no children are SKIPPED (logged), never expanded into new issues.</critical>
  <critical>Every teammate's initial instructions come from a lead-authored task-list entry. SendMessage is only for activation nudges and fix-cycle iteration.</critical>
  <critical>Spawn a FRESH pair per leaf task. Shut down BOTH teammates on approval before moving on.</critical>
  <critical>The lead owns team cleanup at the end of the run. Teammates never tear down the team.</critical>
  <critical>For parallelism, read ready task bodies and serialize tasks that plausibly share files. Do NOT rely on post-hoc modifiedFiles metadata.</critical>
  <critical>Never bypass commit hooks. If a hook fails, spawn a developer teammate to fix it, then re-commit.</critical>
  <critical>Stop for infrastructure errors (permissions, missing tools, network) and `AskUserQuestion`. Do not work around them.</critical>
  <critical>Always update Trellis state (complete_task, append_issue_log) BEFORE committing, so `.trellis/` changes are included in the commit.</critical>
  <critical>ALWAYS spawn the implementation reviewer (`trellis-implementation-reviewer`) with `model: "opus"` passed explicitly to `Task`, regardless of task complexity.</critical>
  <critical>After authoring a pair's task-list entries, the lead MUST send "begin assigned work" to the developer via SendMessage before stepping back. Do NOT rely on the developer picking up work autonomously.</critical>
  <important>Spawn the developer (`trellis-developer`) with the default `sonnet` model unless the task warrants Opus (architectural/cross-cutting, security-sensitive, flagged complex by technical-discovery, retry of a failed attempt, or long/vague body). When escalating to Opus, log the reason via `append_issue_log`.</important>
</rules>
