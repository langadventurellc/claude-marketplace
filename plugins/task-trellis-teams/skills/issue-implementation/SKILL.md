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

### 2. Research and Planning Phase (default — see fast-path exception below)

**Research the codebase and plan your approach:**

- **Read parent issues for context**: Use `get_issue` to read the parent feature for context and requirements. Do not continue until you have claimed a task.
- **Research codebase patterns**: Search for similar implementations, conventions, and patterns in the codebase
- **Plan your approach**: Identify the files to modify, patterns to follow, and dependencies needed
- **CRITICAL - Verify your findings**: Spot-check before implementing:
  - Verify 2-3 key file paths actually exist
  - Confirm at least one pattern/convention identified
  - Check that referenced imports or dependencies are real

**When You Find Issues:**

- **Minor issues** (wrong path, naming): Adapt and continue
- **Major issues** (approach wrong, files don't exist): **STOP** and alert the user
- **Pattern mismatches**: Follow actual codebase patterns
- **Missing dependencies**: Check if installation needed or find alternatives

#### Fast-path exception (opt-in, not default)

When the task body **fully specifies** the edit, you may skip the broad research phase and proceed directly to §4 Implementation. Fast-path applies only when ALL of the following are true:

1. The task body names every file to modify (exact paths, no ambiguity).
2. The task body specifies each change at the level of "replace X with Y", "insert paragraph at line N", or equivalent find/replace or diff-style directives.
3. The acceptance criteria are unambiguous and do not name any cross-file invariants that would require investigation to verify.

**When in doubt, use the full research phase.** Fast-path is an opt-in optimization — apply it only when you are confident all three criteria are met. If you discover during implementation that an assumption was wrong (a file doesn't exist, a referenced line has shifted, a cross-file invariant is named that you missed), fall back to the full research phase for that file.

**Do not skip the spot-check.** Even on fast-path, verify that the named file paths exist and the referenced line numbers / strings are present before editing. A one-minute spot-check is not the research phase; it is the minimum due-diligence to avoid editing the wrong location.

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
