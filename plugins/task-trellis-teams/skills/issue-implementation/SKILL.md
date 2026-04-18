---
name: issue-implementation
description: This skill should be used when the user asks to "implement task", "claim task", "work on task", or mentions implementing a single task in Trellis. For features (which orchestrate multiple tasks), use issue-implementation-orchestration instead.
allowed-tools:
  - mcp__task-trellis__claim_task
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__get_next_available_issue
  - mcp__task-trellis__complete_task
  - mcp__task-trellis__append_issue_log
  - mcp__task-trellis__append_modified_files
  - mcp__task-trellis__update_issue
  - mcp__task-trellis__list_issues
  - mcp__perplexity-ask__perplexity_ask
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

### 2. Research and Planning Phase (MANDATORY)

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

### 5. Complete Task

**Verify and document completion:**

- **Verify all requirements met**: Check implementation satisfies task description
- **Confirm quality checks pass**: All tests, linting, and formatting clean
- **Write meaningful summary**: Describe what was implemented and key decisions
- **List all changed files**: Document what was created or modified

Use `complete_task` with task ID, summary, and files changed.

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
