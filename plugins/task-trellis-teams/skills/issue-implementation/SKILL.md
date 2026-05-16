---
name: issue-implementation
description: Claims a single Trellis task and runs a plan-then-implement workflow — researches the task and parent feature, plans the implementation, writes the code, calls complete_task, and hands off to the paired reviewer teammate. Leaves changes uncommitted for review. Use when the user asks to "implement task", "claim task", or "work on task" by ID or scope. For multi-task feature orchestration, use task-trellis-teams:implement-trellis-issues instead.
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__claim_task
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__complete_task
  - mcp__plugin_task-trellis-teams_task-trellis__append_modified_files
  - mcp__plugin_task-trellis-teams_task-trellis__append_issue_log
  - TaskUpdate
  - TaskList
  - SendMessage
  - Glob
  - Grep
  - Read
  - Edit
  - Write
  - Bash
  - AskUserQuestion
---

# Implement Trellis Task

Claim and implement a single task from the Trellis task management system using the Research and Plan → Implement workflow.

## Input

`$ARGUMENTS` (optional) - Can specify:

- **Task ID**: Specific task ID to claim (e.g., "T-create-user-model")
- **Scope**: Hierarchical scope for task filtering (P-, E-, F- prefixed)
- **Force**: Bypass validation when claiming specific task (only with task ID)

**If no task ID specified**: Claims the next available task based on priority and readiness (prerequisites satisfied).

## Process

### 1. Claim Task

Use `claim_task` to claim the task.

`claim_task` returns the full task body; do NOT call `get_issue` on the claimed task ID again — that is a redundant round-trip.

### 2. Research and Planning Phase

#### Attachment consultation (mandatory)

Before researching the codebase, check the task body for an `## Attachments` section. If one is present:

1. Read each referenced file directly from the absolute on-disk path embedded in the section. `Read` does not expand `~`, `$HOME`, or `${TRELLIS_DATA_DIR:-...}` — if the body's path is shell-templated or otherwise unreadable, fetch the holder issue via `get_issue` and inspect its top-level `attachments` array, then locate the file with `bash -c 'find "${TRELLIS_DATA_DIR:-$HOME/.trellis}" -name "<filename>" -path "*/<holder-id>/attachments/*"'`.
2. Treat each attachment as **primary source material**, not background reading:
   - If a design file is referenced → the implementation must visually and structurally conform to it.
   - If a spec document is referenced → its requirements are load-bearing, not advisory.
   - If an existing stylesheet or asset is referenced as reusable → reuse it; do not recreate it.
3. If your implementation deviates from an attached source file, explain why in the `complete_task` summary. Unexplained deviations are treated as defects by the implementation reviewer.

#### Research and plan

Read the parent feature/epic via `get_issue` to ground your work, then explore the codebase enough to form a concrete implementation plan: which files change, what the changes are, and the order to make them. Verify referenced file paths exist before planning changes against them.

Plan internally — do not write the plan back to the Trellis task.

#### Verify the spec against reality

**Trellis task specs are authored before implementation and routinely drift from the code they plug into.** Function signatures, return shapes, field names, types, error contracts, and component props in the spec are *claims about the world*, not ground truth. Treating them as ground truth and implementing literally is the single most common defect in this workflow.

Before writing any code, for every interface the task touches (functions, modules, APIs, hooks, components, data structures, CLI flags, env vars, message formats):

1. **Find the call sites.** Use `Grep` / `Glob` to locate every existing place that will consume the new or changed code. Include tests as call sites — test expectations are part of the contract.
2. **Read each call site.** Confirm that what the spec describes (input arguments, return shape, types, thrown errors, side effects, naming) matches what the callers actually pass in and destructure / consume on the other side.
3. **Treat the callers as the source of truth when they disagree with the spec.** The spec was written from a guess about the surrounding code; the callers *are* the surrounding code.

When you find a mismatch, classify it:

- **Resolvable mismatch** — the right behavior is clear from the call sites (spec named a field `userId` but every caller reads `accountId`; spec returns a single object but every caller iterates an array; spec omits an error case the callers explicitly handle). Implement what the call sites actually need and **call out the deviation in the `complete_task` summary** so the reviewer can see why your implementation diverges from the task body.
- **Ambiguous mismatch** — multiple callers want incompatible things, intent is genuinely unclear, or following the spec literally would break callers in a way you can't unilaterally resolve. **Stop and use `AskUserQuestion` before implementing.** Describe the spec's claim, what the call sites actually expect, and the candidate resolutions.

Do not implement the spec literally when it conflicts with the actual call sites. A working integration matters more than a faithful transcription of the task description, and silent literal implementations against a wrong spec are the failure mode this step exists to prevent.

### 3. Clarify Before Implementing

**When in doubt, ask.** Use AskUserQuestion to clarify requirements or approach. Agents tend to be overconfident about what they can infer—a human developer would ask more questions, not fewer. If you're making assumptions, stop and ask instead.

### 4. Implementation Phase

Execute the plan from step 2.

### 5. Finalize (run steps in this exact order)

**Verify all requirements are met and quality checks pass before starting these steps.**

1. Call `append_modified_files` with the list of every file created or modified.
2. Call `complete_task` with the task ID, a one-paragraph summary of what was implemented and key decisions made, and the same file list.
3. Call `TaskUpdate({ taskId: <impl-task-list-id>, status: "completed" })` to mark the shared task-list impl entry done.
4. Send a **pointer-only** `SendMessage` to the paired reviewer naming the review task-list task ID:
   ```
   SendMessage({ to: "<reviewer-name>", summary: "<review-task-id> begin", message: "claim and begin <review-task-list-task-id>" })
   ```
   Then wait for the reviewer's ack `SendMessage({ to: ..., message: "claimed" })`. If no ack within ~60s, inspect `TaskList` first; re-nudge only if the reviewer's task is still unclaimed.

**Why this order matters:** Each step unblocks the next and protects a downstream gate:

- `complete_task` must precede the task-list `TaskUpdate` — marking the task-list entry done first triggers a downstream lookup that fails with "ID undefined" because the Trellis task is not yet in `done` state.
- The pointer-only nudge names the review task-list task ID, allowing the reviewer to self-claim on receipt. Send the nudge only after the impl task-list entry is marked `completed` (step 3) — the reviewer reads that entry immediately on claiming.

Note: `append_issue_log` is optional and is not part of the required finalize sequence; you may call it at any point during implementation to record progress notes.

**Reviewer will block if any of the following are true at review time:**

- The Trellis task status is not `done` (i.e., `complete_task` was not called or failed).
- `modifiedFiles` on the Trellis task is absent or empty (i.e., `append_modified_files` was not called).

Fix these before sending the reviewer nudge — re-calling `complete_task` and `append_modified_files` with corrected data is always allowed.

**STOP!** - Complete one task only. Do not implement another task.

### 6. Final Response

Include the task's resulting status (`done`, `in-progress`, or `open`) in your final message so the caller knows the outcome.

### 7. Do NOT Commit

**Do not commit your changes.** Leave files uncommitted (staged or unstaged) so the reviewer can see the diff; a separate reviewer/agent will commit after review. Do not invoke `/commit` or run `git commit` yourself.
