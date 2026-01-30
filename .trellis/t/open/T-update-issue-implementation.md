---
id: T-update-issue-implementation
title: Update issue-implementation orchestration with branch creation, review
  cycles, and commits
status: open
priority: high
parent: none
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T00:58:54.400Z
updated: 2026-01-30T00:58:54.400Z
---

# Update Issue-Implementation Orchestration

Enhance the orchestration workflow in `plugins/task-trellis/skills/issue-implementation/orchestration.md` to add intelligent review loops, automatic branching, per-task commits, and documentation updates.

## Reference

Full requirements: `docs/orchestration-enhancements-requirements.md` (Change 1)

## Changes Required

### 1.1 Branch Creation

Add a new step at the start of orchestration (before "Verify Planned Work Exists"):

- Check current git branch using `git branch --show-current`
- If on `main`, create and checkout a feature branch: `feature/{ISSUE_ID}` (e.g., `feature/F-add-user-auth`)
- If already on a non-main branch, continue without branching
- Log the branch creation/status to the issue log

### 1.2 Optional Implementation Planning

Add after verifying planned work exists, before determining execution order:

- Evaluate complexity of the feature/epic based on:
  - Number of tasks
  - Task descriptions (look for refactoring, migration, architectural language)
  - Multiple integration points or subsystems
- If judged sufficiently complex, spawn `issue-implementation-planner` as async subagent using the Task tool with `run_in_background: true`
- Wait for planner to complete and incorporate its output as context for implementation agents
- This is a judgment call—no hard threshold required

### 1.3 Per-Task Review Cycle

Modify section "4. Execute Children" to add review after each task:

- After task implementation completes (step 4.3), evaluate if review is warranted
- **Trivial tasks** (judgment call: single config change, one-line fix) may skip review
- **Non-trivial tasks**: spawn `issue-implementation-review` as async subagent
- Wait for review to complete
- Handle review outcomes:
  - **No findings**: Proceed to commit
  - **Minor issues**: Auto-fix and proceed
  - **Major issues**: Pause, ask user how to proceed using AskUserQuestion
  - **Questions requiring answers**: Pause orchestration, get user answers, re-run review

### 1.4 Per-Task Commits

Add commit step after review passes:

- After task implementation and review pass, commit the changes
- Use `git add` for modified files and `git commit` with message referencing task ID
- Commit message format: `[TASK_ID] Summary of changes`
- Continue to next task only after successful commit

### 1.5 Documentation Update on Feature Completion

Modify section "6. Complete Parent Issue":

- After all child tasks completed and committed (before updating parent status to done)
- Spawn `docs-updater` skill as async subagent using Task tool
- Wait for docs-updater to complete
- Commit any documentation changes made by docs-updater
- Only then mark feature as done and report completion

## Acceptance Criteria

- [ ] Creates `feature/{ISSUE_ID}` branch when starting from main
- [ ] Evaluates complexity and optionally invokes planner as async subagent
- [ ] Spawns implementation review after each non-trivial task
- [ ] Auto-fixes minor review findings, escalates major ones to user
- [ ] Pauses for user input when review has questions
- [ ] Commits after each task is implemented and reviewed
- [ ] Invokes docs-updater before marking feature complete
- [ ] Waits for docs-updater before reporting done

## Technical Notes

- Use Task tool with `run_in_background: true` for async subagents
- Use TaskOutput to wait for and retrieve async subagent results
- Reference existing patterns in `orchestration.md` for subagent spawning
- The skill already has Bash in allowed-tools for git commands