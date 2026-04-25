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
5. Updating documentation by default (unless `--no-docs` is passed) and/or committing changes per wave plus a final end-of-run commit capturing coherence-review and docs changes (`--commit`).

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
- `--commit` (optional flag): After each wave drains, the lead commits that wave's changes. After all waves complete and the final-wave phases (coherence review §0, docs-updater §1, version bump §1.5) finish, the lead produces a final end-of-run commit for those changes. The lead authors a concise conventional-commit message for each commit (see §2).
- `--no-docs` (optional flag): Skip the docs-updater phase (default: docs are updated after the final wave drains, before the final end-of-run commit). When `--commit` is also set without `--no-docs`, docs updates are always included in the final end-of-run commit.
- `--version [major|minor|patch]` (optional flag): When set, the lead invokes the `planning:versioning` skill in Completion Phase §1.5 (after docs, before the final commit). If present without a value, the versioning skill infers the bump level from the diff. This flag is independent of `--no-docs` — version bumping runs whether or not docs were updated.

If `--commit` is not set, the run leaves uncommitted changes for the user (docs-updater still runs unless `--no-docs` is passed; `planning:versioning` still runs if `--version` is passed).

## Preflight

Scan `$ARGUMENTS` for `--commit`, `--no-docs`, and `--version` tokens and remove them from the scope argument. The remaining argument (if any) is the scope ID.

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

Claim and read the task body in one call: `mcp__plugin_task-trellis-teams_task-trellis__claim_task` with T-<task-id>. Do not call `get_issue` on this task ID — `claim_task` returns the full body.

If the task body includes an `## Attachments` section, read each referenced file from its on-disk path before writing any code (no `get_issue` on the holder required). Attachments are primary source material — the skill's attachment-consultation step is mandatory and is NOT skipped on any path.

Skill: `task-trellis-teams:issue-implementation` (or read `plugins/task-trellis-teams/skills/issue-implementation/SKILL.md` directly).

Paired reviewer: <reviewer teammate name>. Send them a pointer-only `SendMessage` naming the review task-list task ID when done.

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

Persist the name→ID map for the run so you can reference these tasks in later updates (marking completed via `TaskUpdate({ taskId, status: "completed" })`, etc.). `TaskUpdate` identifies tasks by `taskId`, not by subject.

This dependency blocks the review task-list entry until the impl entry is marked `completed`, so the reviewer cannot claim it early.

### 2. Spawn a fresh pair

Spawn two teammates tied to this one task:

- A **developer** of agent type `task-trellis-teams:trellis-developer`.
- A **reviewer** of agent type `task-trellis-teams:trellis-implementation-reviewer`.

Give the pair distinguishable teammate names (e.g., `dev-T-add-login` and `rev-T-add-login`) so `SendMessage` routing is unambiguous. Tell each teammate at spawn the name of its pair partner so they can address each other directly.

#### Model selection

**Agent frontmatter is authoritative for model selection. NEVER pass a `model` parameter to the `Task` tool when spawning teammates.** The `Task`-tool `model` enum (`sonnet | opus | haiku`) does not preserve the `[1m]` context-window variant declared in an agent's frontmatter — passing `model` at spawn time silently strips `[1m]` and downgrades the teammate's context window. To pick a different model, pick a different `subagent_type`.

Developer teammates are always `task-trellis-teams:trellis-developer` (Sonnet). Never pass a `model` override to `Task`. The implementation reviewer stays on its frontmatter-declared `opus[1m]`. If a coding task genuinely needs deeper reasoning, it should be reflected in a more detailed `## Implementation Plan` in the task body (produced by `planning:create-implementation-plan` at task-authoring time), not in a stronger developer model at implementation time.

### 3. Pair executes autonomously

The lead does not intervene once the pair is running. Expected flow:

0. **Lead sends start nudge.** After authoring the two task-list entries for this pair (impl + review), the lead MUST send a `SendMessage` to the developer:
   ```
   SendMessage({ to: "<developer-name>", summary: "<impl-task-id> begin", message: "claim and begin <impl-task-list-task-id>" })
   ```
   where `<impl-task-list-task-id>` is the shared-task-list task ID for the impl entry (captured in §1). The reviewer does not need a nudge — its task is blocked until the developer completes.

   Wait for the developer's ack `SendMessage({ to: 'team-lead', ... message: 'claimed' })`. If no ack within ~60s, inspect `TaskList` first; re-nudge only if the task is still unclaimed.
1. Developer claims the impl task-list entry and the Trellis task (`mcp__plugin_task-trellis-teams_task-trellis__claim_task`), implements, runs its own checks, marks the Trellis task done via `complete_task`, marks the impl task-list entry done, and sends a `SendMessage` nudge to the reviewer:
   ```
   SendMessage({ to: "<reviewer-name>", summary: "<review-task-id> begin", message: "claim and begin <review-task-list-task-id>" })
   ```
2. Reviewer's task-list entry unblocks. Reviewer claims it, reviews the changes, and either:
   - **Approves:** Marks the review task-list entry done.
   - **Has findings:** `SendMessage` directly to the developer with findings. Does NOT mark the review task done.
   See `PROTOCOL.md` §Reviewer activation gate.
3. Developer receives findings, fixes, then `SendMessage`s the reviewer when fixes are ready. Reviewer re-reviews. Repeat until approved.
4. Once the review task-list entry is marked done, the pair's work is complete.

### 4. Shut down the pair

When the review task-list entry is marked done (approval), the lead shuts down **both** teammates in the pair. A fresh pair will be spawned for the next ready task. This is a deliberate design choice:

- Prevents cross-task context bleed from one implementation into the next.
- Guarantees the bias guarantee holds per-issue (no reviewer carrying opinions forward).
- Keeps teammate context windows small.

### 5. Unblock next tasks

When a pair within the current wave is approved, wait for all remaining pairs in the wave to finish. After the **current wave fully drains** (all pairs approved and shut down), re-evaluate the implementation queue: any task whose prerequisites are now all `done` becomes a candidate for the next wave. Spawn the next wave per the Running Queue rules below.

## Running Queue (informed-judgment parallelism)

Pair spawning is **wave-based**. A **wave** is the complete set of pairs the lead spawns together after a single queue evaluation. All ready candidates at evaluation time are spawned together (applying the overlap heuristic and concurrency cap within the wave); the queue is re-evaluated only after the **current wave fully drains** — meaning all pairs in the wave are approved and shut down.

> **Per-wave commit (under `--commit`):** After each wave drains, flush Trellis state for all tasks in the wave and commit immediately before evaluating the next wave. See Completion Phase §2 for the full per-wave commit procedure. Coherence Review (§0) is **not** performed between waves — it runs once after the final wave drains.

### Candidate queue

The candidate queue contains every leaf task whose:
- Status is not `done` or `wont-do`, AND
- All prerequisite tasks are `done`.

The queue is re-evaluated after the entire current wave drains (and after the initial tree walk in Scope Resolution step 2).

### Spawning decision

When evaluating which candidate(s) to spawn next:

1. **Read each ready candidate's body** via `get_issue` — specifically the description, technical approach, and acceptance criteria.
2. **Ask: could these tasks plausibly modify the same files, or the same narrow area of the codebase?**
   - If yes → serialize: spawn only the highest-priority candidate and wait for it to complete before spawning the next.
   - If no → run in parallel: spawn all non-overlapping candidates concurrently.
3. Do NOT use `affectedFiles` / `modifiedFiles` metadata from Trellis for this decision — that is populated after implementation and is not available pre-spawn.
4. **Bias toward parallelism.** Serial is the safe fallback when overlap is plausible, not the default.

### Concurrency cap

Do not run more than **three or four pairs** concurrently. Exceeding this creates coordination overhead, clutters `SendMessage` routing, and may exhaust teammate slots. When the cap is reached, buffer the overflow candidates in the queue; they are not spawned mid-wave. They are evaluated as part of the next wave, after the current wave fully drains.

### Prerequisite unblocking

After the current wave drains, re-check the full candidate queue: any task whose last blocking prerequisite just moved to `done` is now a new candidate for the next wave. Evaluate it per the steps above.

### Example event flow

```
Queue: [A(ready), B(ready), C(blocked on A), D(ready)]
Cap: 3

Wave 1 (t=0):   A, B, D non-overlapping → spawn pair-A, pair-B, pair-D. (cap reached)
                C blocked on A — held for next wave.
Wave 1 drains (t=12): pair-A, pair-B, pair-D all approved and shut down.
                [--commit] Flush Trellis state → commit changes.
                A done → C unblocks → candidates: [C(ready)]
Wave 2 (t=12):  C ready, non-overlapping → spawn pair-C.
Wave 2 drains (t=15): pair-C approved and shut down.
                [--commit] Flush Trellis state → commit changes.
Queue empty. Continue to Completion Phase (§0 coherence review, §1 docs, §2 final commit).
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

> **Ordering note:** When `--commit` is set, per-wave commits occur during the queue loop (before this phase). The final-wave ordering is: Coherence Review (§0) → docs-updater (§1) → version bump (§1.5, only if `--version`) → final end-of-run commit (§2). Per-wave commits do not affect this ordering.

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

Spawn this reviewer as `task-trellis-teams:trellis-implementation-reviewer` with NO `model` override — trust the agent's frontmatter (`opus[1m]`). After authoring the task-list entry, send a pointer-only `SendMessage` nudge to start the reviewer:
```
SendMessage({ to: "rev-coherence-<scope-id>", summary: "<coherence-task-id> begin", message: "claim and begin <coherenceTaskId>" })
```
Wait for it to mark the task-list entry `done`, then shut it down.

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
1. Author the developer task-list entry with the full list of findings to fix and the files to touch. Make clear this is a reconciliation pass (not a new Trellis task) so the developer does not attempt `claim_task` or `complete_task`. The body MUST instruct the developer to (a) apply fixes directly to the working tree, (b) mark this task-list entry `completed` when done, and (c) send a pointer-only `SendMessage` to the paired reviewer (`rev-reconcile-<scope>`) naming the reviewer's task-list task ID immediately after marking the entry `completed` — this mirrors the standard Per-Issue Pair Lifecycle §3 step 1 handoff and is required for the reviewer's activation gate to fire.
2. Author the reviewer task-list entry blocked on the developer entry. The body MUST include:
   - The paired developer teammate name (e.g., `dev-reconcile-<scope>`).
   - The coherence review findings being resolved (copy the findings inline or reference the coherence review task entry).
   - The list of files expected to be touched (same list as the developer entry), plus the base branch to diff against.
   - **Review procedure (reconciliation carve-out):** Review the changes by running `git diff <base-branch>...HEAD -- <file1> <file2> ...` against the findings enumerated in the developer entry. Read each changed file for context. Verify each finding is resolved in the diff. Do NOT call `get_issue`, `claim_task`, `complete_task`, or `append_modified_files` — there is no corresponding Trellis task for this pass. Do NOT rely on `modifiedFiles` metadata.
   - **Carve-out note (named exception to the standard reviewer blocking-guard):** For a reconciliation-pass review, an empty/absent `modifiedFiles` list and a non-`done` Trellis task status are NOT blocking findings — the standard blocking-guard from `task-trellis-teams:issue-implementation-review` §2 (which blocks review when `modifiedFiles` is empty or the Trellis task is not `done`) does NOT apply here.
   - **Approval / findings flow:** If there are no blocking findings, mark this task-list entry `completed` via `TaskUpdate`. On findings, send a single `SendMessage` to the paired developer with findings grouped by severity (standard fix-cycle pattern) and wait for the developer's fix-ready nudge before re-reviewing.
3. Spawn a fresh developer and reviewer pair (same model selection rules as per-issue pairs). Name them clearly (e.g., `dev-reconcile-<scope>`, `rev-reconcile-<scope>`).
4. Send the developer a pointer-only nudge: `SendMessage({ to: "dev-reconcile-<scope>", summary: "<reconcile-task-id> begin", message: "claim and begin <reconcileImplTaskId>" })` where `<reconcileImplTaskId>` is the task-list task ID for the reconciliation developer entry. The reviewer does NOT need a lead nudge — it will be activated by the developer's handoff nudge (step 1.c) once the developer's task-list entry is marked `completed`.
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

Do NOT bump any version files. The lead invokes `planning:versioning`
separately in §1.5 if `--version` was passed.
```

Wait for that teammate to mark the task-list entry done, then shut it down.

### 1.5. Version bump (only if `--version`)

If the lead was invoked with `--version`, invoke the `planning:versioning` skill **directly from the lead** (do NOT spawn a teammate):

```
Skill(skill="planning:versioning", args="<bump-spec>")
```

Where `<bump-spec>` is:

- `--version <level>` if `--version` was passed with an explicit level (`major`, `minor`, or `patch`).
- `--version` if `--version` was passed without a value (the skill will infer from the diff).

Capture the skill's `## Version Bumps` output for the final-summary §4. If the skill returns a usage message or a "no version files bumped" report despite `--version` having been requested, surface that as a loud warning in the final summary — do NOT silently drop it.

This step runs **independently of `--no-docs`**. Version bumping happens whenever `--version` was passed, regardless of whether docs were updated.

If `--commit` is set, any version-file edits produced here are included in the final end-of-run commit in §2. If `--commit` is not set, the edits are left uncommitted alongside other changes.

### 2. Commit (only if `--commit`)

Commit behavior under `--commit` has two parts: **per-wave commits** (performed during the queue loop after each wave drains) and a **final end-of-run commit** (performed here, after §0 coherence review, §1 docs-updater, and §1.5 version bump complete).

#### Commit message style (applies to every commit the lead produces)

Write a concise conventional-commit subject: `type: description`, under ~50 characters.

- **Types:** `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`.
- **Style:** imperative mood, capitalize the first word, no trailing period.
- **Focus:** describe *what changed and why* based on the actual diff. Skip run mechanics — **do not** include wave ordinals, task IDs, phase names (e.g., "post-implementation"), or teammate/pair details.
- **Examples:** `feat: add login rate limiting`, `refactor: extract session validation`, `docs: update plugin install steps`.

Pick the subject by inspecting the staged diff (`git diff --cached --stat` and spot-check changes as needed), not by summarizing the task list.

#### Per-wave commit procedure (performed in the queue loop)

After all pairs in a wave are approved and shut down:

1. **Flush Trellis state:** Verify that all `complete_task`, `append_modified_files`, and `append_issue_log` calls for that wave's tasks have completed so `.trellis/` changes are staged alongside code.
2. **Commit the wave:**
   ```bash
   git add .
   git commit -m "<concise conventional-commit subject per the style rubric above>"
   ```
   Do NOT pass `--no-verify` and do NOT skip hooks. Do NOT force-push or touch remotes.
3. **Evaluate the next wave** (see Running Queue section).

**Handling commit-hook failures (per wave):** If a wave commit fails due to a pre-commit or commit-msg hook:

1. Identify which Trellis task's code caused the failure (inspect the hook output).
2. Spawn a fresh `trellis-developer` teammate for that task with a lead-authored task-list entry asking them to fix the hook error. Include the full hook output in the task body.

   **Intentional exception to the fresh-pair-per-issue rule:** spawn a lone developer here, NOT a new developer/reviewer pair. The fix is narrowly scoped to satisfying the commit hook; if it expands beyond that scope, stop and `AskUserQuestion`.
3. Wait for the fix, shut that developer down, and re-attempt the wave commit.
4. Repeat until the commit succeeds.

**Do NOT debug hook failures from the lead.** Route the error to a developer teammate.

#### Final end-of-run commit (performed here, after §0, §1, and §1.5)

After §0 (coherence review), §1 (docs-updater), and §1.5 (version bump, if `--version` was passed) complete, produce a final commit capturing those changes using the same style rubric:

```bash
git add .
git commit -m "<concise conventional-commit subject per the style rubric above>"
```

If `--commit` is NOT set, leave all uncommitted changes for the user (docs-updater still runs unless `--no-docs`; `planning:versioning` still runs if `--version` was passed).

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
- **Version bumps** (one `path: old → new` line per bumped file, when `--version` was passed). If `--version` was passed but no files were bumped, emit a loud warning line: `⚠ --version was requested but no version files were bumped — check the planning:versioning output above.`
- **Reconciliation pass** (yes/no, and count of findings resolved if yes) — so the user has post-hoc visibility into any auto-remediation the lead performed after the coherence review.
- **Commit SHA** (if `--commit` ran) or a clear note that uncommitted changes remain.
- **How to verify** the changes (e.g., run the test suite, try the new CLI command, visit the endpoint).

## Important Constraints

- **Orchestration only.** The lead does NOT write or debug code. The lead spawns teammates, authors task-list entries, routes errors back to teammates, and commits approved changes. That is all.
- **Bias guarantee — initial instructions come from the lead only.** Every teammate receives its initial instructions from a lead-authored task-list entry. Teammates never pass initial instructions to each other. Direct `SendMessage` is only for (a) pointer-only activation nudges and (b) fix-cycle iteration after the initial unbiased instructions.
- **Fresh pair per issue.** Each leaf task gets its own developer and reviewer pair. Both teammates are shut down on approval. Nothing carries over to the next task.
- **No new Trellis issues.** The lead, developer, and reviewer NEVER create new Trellis issues during an implementation run. Unplanned work is logged and/or reported to the user at the end — not materialized as issues.
- **Unplanned non-leaf skip.** If a non-leaf issue has no children, skip it and continue to siblings. Never synthesize children for it.
- **Recursive by default.** A feature walks its tasks. An epic walks its features and their tasks. A project walks everything below it. There is no flag to disable recursion; a task-level scope is naturally a single item.
- **Informed-judgment parallelism.** Read ready task bodies; serialize tasks that might touch the same files. Do not rely on post-hoc metadata.
- **Team cleanup is the lead's responsibility.** Teammates never tear down the team.
- **Respect prerequisites.** Never spawn a pair for a task whose prerequisites are not `done`.
- **Per-wave commits (only if `--commit`).** Under `--commit`, one commit is produced per wave after all pairs in the wave are approved and Trellis state is flushed. A final end-of-run commit captures coherence-review changes, docs-updater output, and version-bump output after the final wave drains.
- **No hook bypass.** When committing, do not use `--no-verify` or skip hooks. Fix the underlying issue via a developer teammate instead.
- **Stop for infrastructure errors.** Permission denied, missing tools, network issues → `AskUserQuestion` and follow user direction. Do not work around.

<rules>
  <critical>The lead NEVER writes or debugs code. Code errors go to the responsible developer teammate.</critical>
  <critical>The lead, developer, and reviewer NEVER create new Trellis issues during an implementation run.</critical>
  <critical>Non-leaf issues with no children are SKIPPED (logged), never expanded into new issues.</critical>
  <critical>Every teammate's initial instructions come from a lead-authored task-list entry. SendMessage is only for activation nudges and fix-cycle iteration.</critical>
  <critical>Spawn a FRESH pair per leaf task. Shut down BOTH teammates on approval before moving on.</critical>
  <critical>The lead owns team cleanup at the end of the run. Teammates never tear down the team.</critical>
  <critical>Pair spawning is wave-based: spawn all ready candidates together as a wave after each queue evaluation. Evaluate the queue for the next wave only after the current wave fully drains (all pairs approved and shut down). For overlap judgment within a wave, read ready task bodies and serialize tasks that plausibly share files. Do NOT rely on post-hoc modifiedFiles metadata.</critical>
  <critical>Never bypass commit hooks. If a hook fails, spawn a developer teammate to fix it, then re-commit.</critical>
  <critical>Cross-Task Coherence Review Critical findings default to the §0a Reconciliation Pass (fresh dev/reviewer pair) — do NOT gate on `AskUserQuestion` by default. Escalate to the user only when a finding needs unmodified-file edits, new Trellis issues, is tagged `[requires-user-decision]`, or recurs after a prior reconciliation pass. Reconciliation passes are capped at 2 per run.</critical>
  <critical>Stop for infrastructure errors (permissions, missing tools, network) and `AskUserQuestion`. Do not work around them.</critical>
  <critical>Before each wave commit and before the final end-of-run commit, flush Trellis state — all `complete_task`, `append_modified_files`, and `append_issue_log` calls for that wave's tasks must complete so `.trellis/` changes are included in the commit.</critical>
  <critical>NEVER pass a `model` parameter to the `Task` tool when spawning teammates. Agent frontmatter is authoritative — the `Task`-tool `model` enum (`sonnet | opus | haiku`) does not preserve the `[1m]` context-window variant declared in frontmatter, so a spawn-time override silently strips `[1m]` and downgrades the teammate's context window. To switch models, change `subagent_type` instead.</critical>
  <critical>After authoring a pair's task-list entries, the lead MUST send a pointer-only `SendMessage` to the developer naming the impl task-list task ID before stepping back. The message body is `'claim and begin <impl-task-list-task-id>'`. Do NOT embed instructions. Do NOT rely on the developer picking up work autonomously.</critical>
</rules>
