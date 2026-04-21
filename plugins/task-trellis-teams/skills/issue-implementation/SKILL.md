---
name: issue-implementation
description: This skill should be used when the user asks to "implement task", "claim task", "work on task", or mentions implementing a single task in Trellis. For features (which orchestrate multiple tasks), use issue-implementation-orchestration instead.
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__claim_task
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__get_next_available_issue
  - mcp__plugin_task-trellis-teams_task-trellis__complete_task
  - mcp__plugin_task-trellis-teams_task-trellis__append_issue_log
  - mcp__plugin_task-trellis-teams_task-trellis__append_modified_files
  - mcp__plugin_task-trellis-teams_task-trellis__update_issue
  - mcp__plugin_task-trellis-teams_task-trellis__list_issues
  - Task
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

Use `claim_task` to claim the task. Tasks are managed in the `.trellis` folder.

`claim_task` returns the full task body; do NOT call `get_issue` on the claimed task ID again — that is a redundant round-trip.

### 2. Research and Planning Phase

#### Attachment consultation (mandatory — not skipped on any path)

Before researching the codebase, check the task body for an `## Attachments` section. If one is present:

1. Read each referenced file directly from its on-disk path. No `get_issue` call on the holder issue is required — the direct path in the task body is sufficient.
2. Treat each attachment as **primary source material**, not background reading:
   - If a design file is referenced → the implementation must visually and structurally conform to it.
   - If a spec document is referenced → its requirements are load-bearing, not advisory.
   - If an existing stylesheet or asset is referenced as reusable → reuse it; do not recreate it.
3. If your implementation deviates from an attached source file, explain why in the `complete_task` summary. Unexplained deviations are treated as defects by the implementation reviewer.

#### Step 1: Check for an Implementation Plan

After consulting attachments, check the claimed task body for an `## Implementation Plan` section. This determines which path to take:

- **Plan present** → Trust-the-plan path (default)
- **Plan absent or marked `_Skipped_`** → Fallback research path

#### Trust-the-Plan Path (default when plan is present)

When the task body contains an `## Implementation Plan` section (and it is not a skip marker):

1. **Spot-check the plan** (mandatory — takes 1–2 minutes):
   - Verify 2–3 named file paths from the plan actually exist on disk.
   - Confirm one named symbol, class, or pattern is present where stated.
   - Check that any referenced imports or dependencies are real.
2. If the spot-check passes, proceed directly to §4 Implementation following the plan's `### File Modifications` and `### Implementation Order` sections as the primary guide.
3. Attachment consultation (from above) is STILL mandatory on this path — do not skip it.

#### Fallback Research Path (when plan is absent or skipped)

When the task body has no `## Implementation Plan` section, or it contains only a skip marker (e.g., `_Skipped — …_`), perform the full research-and-plan workflow:

- Read parent issues for context via `get_issue` on the parent feature.
- Search for similar implementations, conventions, and patterns in the codebase.
- Plan the approach: identify files to modify, patterns to follow, dependencies.
- Spot-check findings: verify 2–3 key file paths exist, confirm at least one pattern, check referenced imports are real.

#### Three-Tier Deviation Ladder

Apply this ladder whenever the plan's description diverges from codebase reality:

**Tier 1 — Minor deviation** (renamed file, shifted line numbers, minor naming drift that does not change the approach):
- Adapt silently and continue.
- Note the adaptation in the `complete_task` summary.

**Tier 2 — Non-trivial deviation** (plan names a module/pattern that does not exist; plan prescribes an approach the current codebase contradicts; plan omits a file that clearly must also change; spot-check fails in a way that casts doubt on the whole plan):
- **STOP**. Do not attempt to silently re-plan.
- Call `append_issue_log` on the Trellis task describing the specific mismatch.
- Send a `SendMessage` to the lead with a short paragraph describing the deviation.
- Wait for user direction before proceeding. The lead decides whether to route back for re-planning, proceed with a revised approach, or abandon the task.

**Tier 3 — Plan absent** (task body has no `## Implementation Plan` section, or it is a skip marker):
- Use the Fallback Research Path above.

### 3. Clarify Before Implementing

**When in doubt, ask.** Use AskUserQuestion to clarify requirements or approach. Agents tend to be overconfident about what they can infer—a human developer would ask more questions, not fewer. If you're making assumptions, stop and ask instead.

Ask questions when:

- Requirements are ambiguous or incomplete
- Multiple valid approaches exist
- You're unsure about architectural decisions
- The task scope seems unclear

### 4. Implementation Phase

**Execute the plan with progress updates:**

- **Write clean code**: Follow project conventions and best practices
- **Implement incrementally**: Build and test small pieces before moving on
- **Run quality checks frequently**: Format, lint, and test after each major change
- **Write purposeful tests**: Only test logic with meaningful complexity
- **Handle errors gracefully**: Include proper error handling

### 5. Finalize (run steps in this exact order)

**Verify all requirements are met and quality checks pass before starting these steps.**

1. Call `append_modified_files` with the list of every file created or modified.
2. Call `complete_task` with the task ID, a one-paragraph summary of what was implemented and key decisions made, and the same file list.
3. Call `TaskUpdate({ taskId: <impl-task-list-id>, status: "completed" })` to mark the shared task-list impl entry done.
4. Send an instruction-free `SendMessage` activation nudge to the paired reviewer.

**Why this order matters:** Each step unblocks the next and protects a downstream gate:
- `complete_task` must precede the task-list `TaskUpdate` — marking the task-list entry done first triggers a downstream lookup that fails with "ID undefined" because the Trellis task is not yet in `done` state.
- The task-list `TaskUpdate` must precede the reviewer activation nudge — the reviewer's activation gate requires BOTH that the paired impl task-list entry has status `completed` AND that the reviewer has received the instruction-free `SendMessage` nudge. If the nudge lands while the impl entry is still `in_progress`, the reviewer silently dismisses it and goes idle, leaving the pair stalled.

Note: `append_issue_log` is optional and is not part of the required finalize sequence; you may call it at any point during implementation to record progress notes.

**Reviewer will block if any of the following are true at review time:**
- The Trellis task status is not `done` (i.e., `complete_task` was not called or failed).
- `modifiedFiles` on the Trellis task is absent or empty (i.e., `append_modified_files` was not called).

Fix these before sending the reviewer nudge — re-calling `complete_task` and `append_modified_files` with corrected data is always allowed.

**STOP!** - Complete one task only. Do not implement another task.

### 6. Final Response

**Always include the resulting task status in your final message.** Report the task's current status (e.g., `done`, `in-progress`, `open`) so the caller knows the outcome. If you completed the task normally, the status will be `done`. If you had to exit early due to errors, blockers, or user direction, report whatever status the task is in (e.g., still `in-progress` or `open`).

### 7. Do NOT Commit

**Your changes must be reviewed before committing.**

- **Do not run git commit** - Leave all changes uncommitted
- **Do not use the /commit skill** - This will be done after review
- **Leave changes staged or unstaged** - The reviewer needs to see the diff
- A separate agent or developer will review your implementation and commit if approved

## Key Constraints

- **Do NOT commit changes** - Leave all changes uncommitted for review by the orchestration skill or another agent
- **Only implement planned work** - Do not create new tasks during implementation
- **Respect dependencies** - Only start work when all prerequisites are completed
- **Stop on errors** - When encountering failures, stop and ask the user how to proceed
