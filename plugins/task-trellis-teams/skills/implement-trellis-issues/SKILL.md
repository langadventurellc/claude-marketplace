---
name: implement-trellis-issues
description: Orchestrates implementation of Trellis issues using Claude Code Agent Teams. The lead session resolves a scope, walks the issue tree, and spawns a fresh developer/reviewer pair per leaf task. Teammates communicate directly via SendMessage for review/fix cycles. Supports --commit, --no-docs, and --version flags. Recursive by default; unplanned non-leaf issues are skipped, never expanded. Use when asked to "implement feature", "implement trellis issues", "execute feature with teams", "implement tasks via agent teams", or whenever an agent-teams-based implementation run is desired.
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__claim_task
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__get_next_available_issue
  - mcp__plugin_task-trellis-teams_task-trellis__complete_task
  - mcp__plugin_task-trellis-teams_task-trellis__append_issue_log
  - mcp__plugin_task-trellis-teams_task-trellis__append_modified_files
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

<critical>
**Lead Orchestration Rule — Read This First**

The lead DOES NOT write, edit, or debug code. The lead DOES NOT fix issues in Trellis child bodies during a run. Every prohibited action below must be routed to the appropriate teammate.

Prohibited lead actions:
- Calling `Edit` or `Write` on any file under `src/`, `plugins/`, or any repo code path (developer's job).
- Running tests, lint checks, or builds to validate or fix a teammate's code (developer's job).
- Calling `mcp__plugin_task-trellis-teams_task-trellis__update_issue` on a child Trellis issue to patch its body or description mid-run (developer's job via update_issue if truly needed; reviewer's job to request it).

Enforcement heuristic: If you find yourself about to call `Edit`, `Write`, or `update_issue` on a child — STOP and ask: is this a teammate's job? It almost certainly is.
</critical>

Orchestrate the implementation of a Trellis scope (feature, epic, task, or next-available) using Claude Code's experimental **Agent Teams** feature. The lead session walks the issue tree, spawns a fresh developer/reviewer pair per leaf task, and lets those teammates coordinate review/fix cycles by direct `SendMessage`. On completion, optionally update docs and/or commit.

**This skill replaces the subagent-based `task-trellis:issue-implementation-orchestration` workflow with an agent-teams variant.** Key differences from the existing plugin:

- Developer and reviewer run as **teammates** inside an agent team and talk to each other directly via `SendMessage` instead of routing all feedback through the lead.
- A **fresh pair is spawned per leaf issue** and shut down on approval (no persistent developer or reviewer across issues).
- The **follow-up-work / issue-creation-during-implementation logic is removed**. Teammates and the lead NEVER create new Trellis issues during an implementation run. If an unplanned non-leaf issue is discovered, it is logged and skipped.

## Goal

Complete every planned leaf task under the given scope by:

1. Walking the issue tree under the scope and enumerating ready leaf tasks (respecting prerequisites and status).
2. For each ready task, authoring two lead-owned task-list entries (impl task → review task with prerequisite), then spawning a fresh `trellis-developer` + `trellis-implementation-reviewer` pair.
3. Letting the pair coordinate implementation, review, and fix cycles via direct `SendMessage`.
4. Shutting down the pair on approval and moving to the next ready task.
5. Updating documentation by default (unless `--no-docs` is passed) and/or committing all changes in a single commit (`--commit`).

## Input

`$ARGUMENTS` format:

```
<scope> [--commit] [--no-docs] [--version [major|minor|patch]]
```

- `<scope>` (optional): A Trellis issue ID. Accepts:
  - **Feature ID** (`F-xxx`) — recursively implements all its tasks (default behavior).
  - **Epic ID** (`E-xxx`) — recursively implements all tasks under all features under the epic.
  - **Project ID** (`P-xxx`) — recursively implements all tasks under all epics and features.
  - **Task ID** (`T-xxx`) — implements a single task.
  - **Empty** — lead calls `get_next_available_issue` (preferring `feature` type) to pick the next scope.
- `--commit` (optional flag): After all pairs finish (docs-updater runs first unless `--no-docs`), the lead makes a single commit of all changes. Uses `/git:commit` skill if available, else falls back to `git add . && git commit -m "<message>"`.
- `--no-docs` (optional flag): Skip the docs-updater phase (default: docs are updated after all pairs finish, before any commit). When `--commit` is also set without `--no-docs`, docs updates are always included in the commit.
- `--version [major|minor|patch]` (optional flag): When set, passes `--version` to the `planning:docs-updater` invocation in Completion Phase §1. If present without a value, docs-updater infers the bump level from the diff. Ignored (with a warning in the final summary) if `--no-docs` is also set.

If `--commit` is not set, the run leaves uncommitted changes for the user (docs-updater still runs unless `--no-docs` is passed).

## Preflight

Scan `$ARGUMENTS` for `--commit`, `--no-docs`, and `--version` tokens and remove them from the scope argument. The remaining argument (if any) is the scope ID.

If both `--version` and `--no-docs` are present, record the conflict: docs-updater will be skipped, so `--version` is silently ignored. Emit a warning line in the final Completion Phase §4 summary: "⚠ --version was ignored because --no-docs was set."

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

### 1. Author the two task-list entries (lead only)

The lead owns both entries. Initial instructions MUST come from the lead — never from another teammate. This preserves the bias guarantee (reviewer is not framed by developer's perspective, and vice versa).

**Impl task** (claimable by the developer immediately):

```
Implement Trellis task T-<task-id> (<task title>).

Parent feature: F-<feature-id> (<feature title>)

Read task body: `mcp__plugin_task-trellis-teams_task-trellis__get_issue` with T-<task-id>.

Skill: `task-trellis-teams:issue-implementation` (or read `plugins/task-trellis-teams/skills/issue-implementation/SKILL.md` directly).

Paired reviewer: <reviewer teammate name>. Nudge them (instruction-free `SendMessage`) when done.

Mark this task-list entry `done` after nudge sent.
```

**Review task** (prerequisite: the impl task; claimable only after impl is done):

```
Review implementation of Trellis task T-<task-id> (<task title>).

Parent feature: F-<feature-id> (<feature title>)

Skill: `task-trellis-teams:issue-implementation-review` (or read `plugins/task-trellis-teams/skills/issue-implementation-review/SKILL.md` directly).

Paired developer: <developer teammate name>.

Mark this task-list entry `done` when approved.
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

### 2. Spawn a fresh pair

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

### 3. Pair executes autonomously

The lead does not intervene once the pair is running. Expected flow:

0. **Lead sends start nudge.** After authoring the two task-list entries for this pair (impl + review), the lead MUST send a `SendMessage` to the developer:
   ```
   SendMessage({ to: "<developer-name>", summary: "T-<task-id> begin assigned work", message: "begin assigned work" })
   ```
   Substitute the actual Trellis task ID for `T-<task-id>`. The reviewer does not need a nudge — its task is blocked until the developer completes.

   > **Authoritative start signal**: This `SendMessage` nudge is the single authoritative activation trigger for the developer. When the lead sets `owner` on a task-list entry via `TaskUpdate`, the runtime automatically emits a `task_assignment` DM to that teammate as an invisible side-effect. That DM is **informational only** — developers MUST NOT begin work on receipt of a `task_assignment` DM. Work begins only when the explicit `SendMessage` nudge above arrives.
1. Developer claims the impl task-list entry and the Trellis task (`mcp__plugin_task-trellis-teams_task-trellis__claim_task`), implements, runs its own checks, marks the Trellis task done via `complete_task`, marks the impl task-list entry done, and sends a `SendMessage` nudge to the reviewer:
   ```
   SendMessage({ to: "<reviewer-name>", summary: "T-<task-id> review ready", message: "review ready" })
   ```
2. Reviewer's task-list entry unblocks. Reviewer claims it, reviews the changes, and either:
   - **Approves:** Marks the review task-list entry done.
   - **Has findings:** `SendMessage` directly to the developer with findings. Does NOT mark the review task done.
   See `PROTOCOL.md` §Reviewer activation gate for the two-condition trigger the reviewer enforces.
3. Developer receives findings, fixes, then `SendMessage`s the reviewer when fixes are ready. Reviewer re-reviews. Repeat until approved.
4. Once the review task-list entry is marked done, the pair's work is complete.

### 4. Shut down the pair

When the review task-list entry is marked done (approval), the lead shuts down **both** teammates in the pair. A fresh pair will be spawned for the next ready task. This is a deliberate design choice:

- Prevents cross-task context bleed from one implementation into the next.
- Guarantees the bias guarantee holds per-issue (no reviewer carrying opinions forward).
- Keeps teammate context windows small.

### 5. Unblock next tasks

After a task's review is approved, re-evaluate the implementation queue: any task whose prerequisites are now all `done` becomes ready. Spawn fresh pairs for the newly-ready tasks (applying the parallelism rule below).

## Running Queue (informed-judgment parallelism)

Pair spawning is **event-driven**, not batch ("wave") based. Whenever a pair's review entry is marked `done` (approval signal), the lead immediately evaluates the candidate queue and spawns the next ready pair — it does not wait for other running pairs to finish first.

### Candidate queue

The candidate queue contains every leaf task whose:
- Status is not `done` or `wont-do`, AND
- All prerequisite tasks are `done`.

The queue is re-evaluated after every pair approval (and after the initial tree walk in Scope Resolution step 2).

### Spawning decision

When evaluating which candidate(s) to spawn next:

1. **Read each ready candidate's body** via `get_issue` — specifically the description, technical approach, and acceptance criteria.
2. **Ask: could these tasks plausibly modify the same files, or the same narrow area of the codebase?**
   - If yes → serialize: spawn only the highest-priority candidate and wait for it to complete before spawning the next.
   - If no → run in parallel: spawn all non-overlapping candidates concurrently.
3. Do NOT use `affectedFiles` / `modifiedFiles` metadata from Trellis for this decision — that is populated after implementation and is not available pre-spawn.
4. **Bias toward parallelism.** Serial is the safe fallback when overlap is plausible, not the default.

### Concurrency cap

Do not run more than **three or four pairs** concurrently. Exceeding this creates coordination overhead, clutters `SendMessage` routing, and may exhaust teammate slots. When the cap is reached, buffer additional ready candidates in the queue and spawn them as running pairs complete.

### Prerequisite unblocking

After each pair approval, re-check the full candidate queue: any task whose last blocking prerequisite just moved to `done` is now a new candidate. Evaluate it for immediate spawning per the steps above.

### Example event flow

```
Queue: [A(ready), B(ready), C(blocked on A), D(ready)]
Cap: 3

t=0  Evaluate: A and D are non-overlapping → spawn pair-A and pair-D.
              B is non-overlapping with both → spawn pair-B. (cap reached)
t=5  pair-D approved → queue now: [C(still blocked on A)]
     Evaluate: no new ready candidates (C blocked). Wait.
t=8  pair-A approved → C unblocks → queue: [C(ready)]
     Evaluate: C is non-overlapping with pair-B → spawn pair-C.
t=12 pair-B approved → queue empty. Continue to Completion Phase.
```

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

### 0. Cross-Task Coherence Review

**Required** when 3 or more sibling tasks were implemented in this run under a shared feature. **Optional** (lead discretion) for ≤2 sibling tasks.

**Overlapping-files criteria:** Collect the modified-files lists reported by developers during the run (via `append_modified_files` / `affectedFiles` on each Trellis task). If two or more implemented tasks touched the same file path, they overlap. When file-level data is unavailable, default to running the review whenever 3+ tasks were implemented.

When the review applies, the lead authors a **single** cross-task coherence review task-list entry and spawns a **fresh** `trellis-implementation-reviewer` teammate (not one of the per-task reviewers, which are already shut down). Use a name like `rev-coherence-<scope-id>`.

**Task-list entry body:**

```
Title: coherence-review-<scope-id>

Body:
Perform a Cross-Task Coherence Review for the sibling tasks implemented under <feature-id> (<feature-title>) in this run.

Implemented task IDs: <comma-separated list of T-xxx IDs>

Skill: `task-trellis-teams:issue-implementation-review` (or read `plugins/task-trellis-teams/skills/issue-implementation-review/SKILL.md` directly).

Follow the "Cross-Task Coherence Review" section of that skill. Read each implemented task via `get_issue`, examine all modified files across the sibling set, and produce findings in `## Review Findings` format.

Mark this task-list entry `completed` when the coherence review is complete (the lead will decide how to act on any findings).
```

Spawn this reviewer with `model: "opus"`. After authoring the task-list entry, send an instruction-free `SendMessage` nudge to start the reviewer. Wait for it to mark the task-list entry `done`, then shut it down.

If the coherence review surfaces Critical findings, the **default behavior is to auto-trigger the §0a Reconciliation Pass** — do not gate on `AskUserQuestion`. The lead proceeds directly into §0a unless any of the following apply, in which case the lead uses `AskUserQuestion` to surface the findings to the user *instead* of running §0a:

- A finding requires changes to files that were not modified by any implemented task in this run.
- A finding requires creating new Trellis issues or otherwise expanding scope beyond the implemented set (the no-new-issues rule is absolute).
- The coherence reviewer explicitly tagged a finding `[requires-user-decision]` (design choice, policy, ambiguous intent — see the tagging convention in `task-trellis-teams:issue-implementation-review` §"Produce findings").
- A Reconciliation Pass has already run in this session and the coherence re-review (§0a "After the pass") still returns Critical findings — treat recurrence as a signal that human judgment is needed.

Otherwise, proceed into §0a directly. The lead NEVER writes code to fix findings itself — fixes are always applied by a fresh developer teammate via §0a. §0a retains its own escalation gate for in-flight scope growth (see §0a Constraints).

### §0a. Reconciliation Pass (when coherence review returns cross-task Critical findings)

**Triggering condition:** The cross-task coherence reviewer (§0) returns Critical findings that span multiple already-closed sibling tasks, OR the user directs a cross-cutting terminology or consistency fix after implementation is otherwise complete.

**What the reconciliation pass is:**
- A named exception to the fresh-pair-per-issue rule.
- The lead authors ONE developer task-list entry and ONE reviewer task-list entry (with the reviewer blocked on the developer, per the standard two-step pattern).
- These entries do NOT correspond to any single Trellis issue — no `claim_task` or `complete_task` is called. The developer applies fixes directly to the working tree; the reviewer verifies via `git diff`. The Trellis task-list entries are the only tracking mechanism for this pass.

**Lead steps:**
1. Author the developer task-list entry with the full list of findings to fix and the files to touch. Make clear this is a reconciliation pass (not a new Trellis task) so the developer does not attempt `claim_task` or `complete_task`. The body MUST instruct the developer to (a) apply fixes directly to the working tree, (b) mark this task-list entry `completed` when done, and (c) send an instruction-free `SendMessage` activation nudge to the paired reviewer (`rev-reconcile-<scope>`) immediately after marking the entry `completed` — this mirrors the standard Per-Issue Pair Lifecycle §3 step 1 handoff and is required for the reviewer's activation gate to fire.
2. Author the reviewer task-list entry blocked on the developer entry. The body MUST include:
   - The paired developer teammate name (e.g., `dev-reconcile-<scope>`).
   - The coherence review findings being resolved (copy the findings inline or reference the coherence review task entry).
   - The list of files expected to be touched (same list as the developer entry), plus the base branch to diff against.
   - **Review procedure (reconciliation carve-out):** Review the changes by running `git diff <base-branch>...HEAD -- <file1> <file2> ...` against the findings enumerated in the developer entry. Read each changed file for context. Verify each finding is resolved in the diff. Do NOT call `get_issue`, `claim_task`, `complete_task`, or `append_modified_files` — there is no corresponding Trellis task for this pass. Do NOT rely on `modifiedFiles` metadata.
   - **Carve-out note (named exception to the standard reviewer blocking-guard):** For a reconciliation-pass review, an empty/absent `modifiedFiles` list and a non-`done` Trellis task status are NOT blocking findings — the standard blocking-guard from `task-trellis-teams:issue-implementation-review` §2 (which blocks review when `modifiedFiles` is empty or the Trellis task is not `done`) does NOT apply here. This carve-out is analogous to the cross-sibling / cross-task coherence review carve-out for the `task_assignment`/activation-gate exception: both are named exceptions triggered by task-list entries that explicitly describe a cross-cutting or reconciliation pass.
   - **Approval / findings flow:** If there are no blocking findings, mark this task-list entry `completed` via `TaskUpdate`. On findings, send a single `SendMessage` to the paired developer with findings grouped by severity (standard fix-cycle pattern) and wait for the developer's fix-ready nudge before re-reviewing.
3. Spawn a fresh developer and reviewer pair (same model selection rules as per-issue pairs). Name them clearly (e.g., `dev-reconcile-<scope>`, `rev-reconcile-<scope>`).
4. Send the developer an activation nudge: `SendMessage({ to: "dev-reconcile-<scope>", summary: "reconciliation pass begin", message: "begin assigned work" })`. The reviewer does NOT need a lead nudge — it will be activated by the developer's handoff nudge (step 1.c) once the developer's task-list entry is marked `completed`.
5. Wait for the reviewer to mark the review entry done, then shut both teammates down.

**After the pass:**
- If the cross-task coherence reviewer (§0) is still active, the lead must request a re-review: `SendMessage({ to: "rev-coherence-<scope>", summary: "reconciliation applied, re-review", message: "reconciliation changes applied — please re-review" })`. Wait for the coherence reviewer to re-approve or surface further findings before proceeding.
- If the coherence reviewer has already been shut down, the lead verifies there are no residual issues by inspecting the change set directly or re-running the coherence review step (§0) with a fresh reviewer.
- **Iteration cap:** Cap Reconciliation Passes at **2 per run**. If the second re-review still returns Critical findings, stop and `AskUserQuestion` — recurrence beyond two passes is a signal that automated remediation is not converging and human judgment is required.

**Constraints:**
- The lead NEVER creates new Trellis issues during a reconciliation pass. If the reconciliation scope grows beyond the original findings, STOP and surface the expansion to the user via `AskUserQuestion`.
- The developer in the reconciliation pass MUST NOT call `claim_task` or `complete_task` — there is no corresponding Trellis task. They implement and mark the task-list entry done only.
- The reconciliation pass is limited to the changes needed to resolve the coherence findings. Do not use it to opportunistically add features or refactor unrelated code.

### 1. Documentation (unless `--no-docs`)

Unless `--no-docs` was passed, spawn a **single** `planning:planning-author` teammate with a lead-authored task-list entry:

```
Title: Update docs for <scope>

Body:
Invoke the `planning:docs-updater` skill to review and update documentation
(CLAUDE.md, README.md, docs/) based on the changes implemented under <scope>
in this branch.

If the `Skill` tool is unavailable to you as a teammate, open
`plugins/planning/skills/docs-updater/SKILL.md` directly and follow it.

Do NOT commit. The lead owns the commit step.

If the lead was invoked with `--version`, pass `--version [value-or-blank]` to the docs-updater invocation.
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
- **Reconciliation pass** (yes/no, and count of findings resolved if yes) — so the user has post-hoc visibility into any auto-remediation the lead performed after the coherence review.
- **Commit SHA** (if `--commit` ran) or a clear note that uncommitted changes remain.
- **How to verify** the changes (e.g., run the test suite, try the new CLI command, visit the endpoint).

## Important Constraints

- **Orchestration only.** The lead does NOT write or debug code. The lead spawns teammates, authors task-list entries, routes errors back to teammates, and commits approved changes. That is all.
- **Bias guarantee — initial instructions come from the lead only.** Every teammate receives its initial instructions from a lead-authored task-list entry. Teammates never pass initial instructions to each other. Direct `SendMessage` is only for (a) instruction-free activation nudges and (b) fix-cycle iteration after the initial unbiased instructions.
- **Fresh pair per issue.** Each leaf task gets its own developer and reviewer pair. Both teammates are shut down on approval. Nothing carries over to the next task.
- **No new Trellis issues.** The lead, developer, and reviewer NEVER create new Trellis issues during an implementation run. Unplanned work is logged and/or reported to the user at the end — not materialized as issues.
- **Unplanned non-leaf skip.** If a non-leaf issue has no children, skip it and continue to siblings. Never synthesize children for it.
- **Recursive by default.** A feature walks its tasks. An epic walks its features and their tasks. A project walks everything below it. There is no flag to disable recursion; a task-level scope is naturally a single item.
- **Informed-judgment parallelism.** Read ready task bodies; serialize tasks that might touch the same files. Do not rely on post-hoc metadata.
- **Team cleanup is the lead's responsibility.** Teammates never tear down the team.
- **Respect prerequisites.** Never spawn a pair for a task whose prerequisites are not `done`.
- **Single commit (only if `--commit`).** All implementation and docs changes (including docs-updater output unless `--no-docs`) go into one commit at the end. No commits between tasks.
- **No hook bypass.** When committing, do not use `--no-verify` or skip hooks. Fix the underlying issue via a developer teammate instead.
- **Stop for infrastructure errors.** Permission denied, missing tools, network issues → `AskUserQuestion` and follow user direction. Do not work around.

<rules>
  <critical>The lead NEVER writes or debugs code. Code errors go to the responsible developer teammate.</critical>
  <critical>The lead, developer, and reviewer NEVER create new Trellis issues during an implementation run.</critical>
  <critical>Non-leaf issues with no children are SKIPPED (logged), never expanded into new issues.</critical>
  <critical>Every teammate's initial instructions come from a lead-authored task-list entry. SendMessage is only for activation nudges and fix-cycle iteration.</critical>
  <critical>Spawn a FRESH pair per leaf task. Shut down BOTH teammates on approval before moving on.</critical>
  <critical>The lead owns team cleanup at the end of the run. Teammates never tear down the team.</critical>
  <critical>Pair spawning is event-driven, not wave-based: on each pair approval, immediately re-evaluate the candidate queue and spawn the next ready pair. For overlap judgment, read ready task bodies and serialize tasks that plausibly share files. Do NOT rely on post-hoc modifiedFiles metadata.</critical>
  <critical>Never bypass commit hooks. If a hook fails, spawn a developer teammate to fix it, then re-commit.</critical>
  <critical>Cross-Task Coherence Review Critical findings default to the §0a Reconciliation Pass (fresh dev/reviewer pair) — do NOT gate on `AskUserQuestion` by default. Escalate to the user only when a finding needs unmodified-file edits, new Trellis issues, is tagged `[requires-user-decision]`, or recurs after a prior reconciliation pass. Reconciliation passes are capped at 2 per run.</critical>
  <critical>Stop for infrastructure errors (permissions, missing tools, network) and `AskUserQuestion`. Do not work around them.</critical>
  <critical>Always update Trellis state (complete_task, append_issue_log) BEFORE committing, so `.trellis/` changes are included in the commit.</critical>
  <critical>ALWAYS spawn the implementation reviewer (`trellis-implementation-reviewer`) with `model: "opus"` passed explicitly to `Task`, regardless of task complexity.</critical>
  <critical>After authoring a pair's task-list entries, the lead MUST send a `SendMessage` to the developer with `summary: "T-<task-id> begin assigned work"` (using the actual Trellis task ID) before stepping back. Do NOT rely on the developer picking up work autonomously.</critical>
  <important>Spawn the developer (`trellis-developer`) with the default `sonnet` model unless the task warrants Opus (architectural/cross-cutting, security-sensitive, flagged complex by technical-discovery, retry of a failed attempt, or long/vague body). When escalating to Opus, log the reason via `append_issue_log`.</important>
</rules>
