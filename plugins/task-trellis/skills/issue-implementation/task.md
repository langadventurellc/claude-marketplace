# Implement Task

Claim and implement a task from the backlog using the Research and Plan → Implement workflow.

## Goal

Claim a task and implement it following project standards, with comprehensive research, planning, and quality checks before marking complete.

## Process

### 1. Claim Task

#### Input

`$ARGUMENTS` (optional) - Can specify:

- **Task ID**: Specific task ID to claim (e.g., "T-create-user-model")
- **Scope**: Hierarchical scope for task filtering (P-, E-, F- prefixed)
- **Force**: Bypass validation when claiming specific task (only with task ID)

Use `claim_task` to claim the task. Tasks are managed in the `.trellis` folder.

**If no task ID specified**: Claims the next available task based on priority and readiness (prerequisites satisfied).

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
- **Log progress**: Use `append_issue_log` to record significant progress milestones

### 5. Complete Task

**Verify and document completion:**

- **Verify all requirements met**: Check implementation satisfies task description
- **Confirm quality checks pass**: All tests, linting, and formatting clean
- **Write meaningful summary**: Describe what was implemented and key decisions
- **List all changed files**: Document what was created or modified
Use `complete_task` with task ID, summary, and files changed.

**STOP!** - Complete one task only. Do not implement another task.

## Quality Standards

- **Research First**: Never skip research phase unless specifically instructed by the user
- **Purposeful Testing**: Write tests only for meaningful complexity—not every piece of code needs tests
- **Quality Checks**: All tests must pass before marking task complete

## Testing

Before writing any tests, read the [Testing Guidelines](testing-guidelines.md).

## Documentation

Before writing any code documentation (docstrings, JSDoc, etc.), read the [Code Documentation Guidelines](code-documentation-guidelines.md).

## Critical: Error Handling

<rules>
  <critical>If you encounter a permission error, STOP IMMEDIATELY and report to the user. Do NOT attempt workarounds.</critical>
  <critical>If a hook returns any unexpected error sor fails, STOP IMMEDIATELY and report to the user. Hook errors indicate important validation failures.</critical>
  <critical>NEVER work around errors by skipping steps, using alternative approaches, or ignoring validation failures.</critical>
  <critical>When blocked by any unexpected error - even if you think it doesn't apply to you - your only options are: (1) ask the user for help, or (2) stop completely.</critical>
  <critical>Do NOT assume an error is irrelevant or a false positive. Report any unexpected errors to the user and let them decide.</critical>
</rules>

If you encounter errors during implementation:

1. **Stop immediately** - Do not continue with broken code
2. **Log the error** - Use `append_issue_log` to document what went wrong
3. **Ask for help** - Use AskUserQuestion to inform the user and ask how to proceed
4. **Do not skip** - Never mark a failed task as complete

**Common error scenarios that require stopping:**

- Permission denied when running commands
- Hook failures (pre-commit, post-edit, quality checks)
- Test failures that you cannot resolve
- Linting or formatting errors from automated tools
- Missing dependencies or configuration issues

**Why this matters**: Hooks are configured to enforce quality checks and validation rules. When they fail, it usually means something is misconfigured or you lack necessary permissions. Working around these errors masks important problems.

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

<rules>
  <critical>ALWAYS follow Research and Plan -> Implement workflow</critical>
  <critical>NEVER skip quality checks before completing task</critical>
  <critical>All tests must pass before marking task complete</critical>
  <critical>STOP and ask the user if you encounter ANY errors or blockers</critical>
  <important>Search codebase for patterns before implementing</important>
  <important>Write tests in the same task as implementation</important>
  <important>Apply security best practices to all code</important>
</rules>
