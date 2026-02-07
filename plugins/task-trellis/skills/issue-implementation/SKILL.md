---
name: issue-implementation
description: This skill should be used when the user asks to "implement task", "claim task", "work on task", or mentions implementing a single task in Trellis. For features, epics, or projects, use issue-implementation-orchestration instead.
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

**Note**: For implementing features, epics, or projects (which orchestrate multiple tasks), use the `issue-implementation-orchestration` skill instead.

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
- **Write purposeful tests**: Only test logic with meaningful complexity (see [Testing Guidelines](testing-guidelines.md))
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

## Quality Standards

- **Research First**: Never skip research phase unless specifically instructed by the user
- **Purposeful Testing**: Write tests only for meaningful complexity—not every piece of code needs tests
- **Quality Checks**: All tests must pass before marking task complete

## Testing

Before writing any tests, read the [Testing Guidelines](testing-guidelines.md).

## Documentation

Before writing any code documentation (docstrings, JSDoc, etc.), read the [Code Documentation Guidelines](code-documentation-guidelines.md).

## Security & Performance Principles

### Security Always:

- **Validate ALL inputs** - Never trust user data
- **Use secure defaults** - Fail closed, not open
- **Parameterized queries** - Never concatenate SQL/queries
- **Secure random** - Use cryptographically secure generators
- **Least privilege** - Request minimum permissions needed
- **Error handling** - Don't expose internal details in error messages

### Forbidden Patterns:

- **NO "any" types** - Use specific, concrete types
- **NO sleep/wait loops** - Use proper async patterns
- **NO keeping old and new code together** - Delete replaced code immediately
- **NO hardcoded secrets or environment values**
- **NO concatenating user input into queries** - Use parameterized queries

## Critical: Error and Failure Handling

<rules>
  <critical>If you encounter a permission error, STOP IMMEDIATELY and report to the user. Do NOT attempt workarounds.</critical>
  <critical>If a hook returns any unexpected errors or fails, STOP IMMEDIATELY and report to the user. Hook errors indicate important validation failures that must be addressed.</critical>
  <critical>NEVER work around errors by skipping steps, using alternative approaches, or ignoring validation failures.</critical>
  <critical>When blocked by any unexpected error - even if you think it doesn't apply to you - your only options are: (1) ask the user for help, or (2) stop completely.</critical>
  <critical>Do NOT assume an error is irrelevant or a false positive. Report any unexpected errors to the user and let them decide.</critical>
  <critical>NEVER mark a task as complete if any unexpected errors occurred during implementation, even if you think the core work succeeded.</critical>
  <critical>NEVER commit changes - leave all changes uncommitted for review by another agent or developer</critical>
  <critical>ALWAYS follow Research and Plan -> Implement workflow</critical>
  <critical>NEVER skip quality checks before completing task</critical>
  <critical>All tests must pass before marking task complete</critical>
  <critical>STOP and ask the user if you encounter ANY errors or blockers</critical>
  <important>Search codebase for patterns before implementing</important>
  <important>Write tests in the same task as implementation</important>
  <important>Apply security best practices to all code</important>
</rules>

**Why this matters**: Hooks are configured to enforce quality checks, permissions, and validation rules. When they fail, it usually means something is misconfigured or you lack necessary permissions. Working around these errors masks important problems and can lead to broken or invalid code being committed.

If you encounter errors during implementation:

1. **Stop immediately** - Do not continue with broken code
2. **Ask for help** - Use AskUserQuestion to inform the user and ask how to proceed
3. **Do not skip** - Never mark a failed task as complete

**Common error scenarios that require stopping:**

- Permission denied when running commands
- Hook failures (pre-commit, post-edit, quality checks)
- Test failures that you cannot resolve
- Linting or formatting errors from automated tools
- Missing dependencies or configuration issues
