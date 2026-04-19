---
name: issue-implementation-review
description: Reviews code changes from a completed task implementation for correctness, completeness, and simplicity. Use when asked to "review implementation", "review task code", "code review", "verify implementation", or after completing an issue implementation.
allowed-tools:
  - Glob
  - Grep
  - Read
  - WebFetch
  - WebSearch
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__list_issues
---

# Issue Implementation Review

Review the code changes from a completed task implementation to verify correctness, completeness, and adherence to simplicity principles.

## Goal

Provide a thorough code review of task implementation changes, ensuring the code correctly and completely solves the issue without over-engineering.

## Required Inputs

- **Task ID**: The Trellis task ID that was implemented (e.g., "T-add-user-validation")
- **Additional Context** (optional): Any decisions or constraints from implementation

## When You Need Clarification

This skill runs as a subagent and cannot ask the user questions directly. If you encounter situations where clarification is needed before proceeding effectively, **return early** with:

1. **Questions**: List each question that needs to be answered
2. **Context Collected**: Summarize what you've learned so far (task details, files examined, findings to date)
3. **Instructions for Caller**: Tell the caller to:
   - Get answers to the listed questions from the user
   - Re-invoke this skill with the original inputs plus the answers

### Example Early Return Format

```
## Clarification Needed

I need additional information before I can complete this review effectively.

### Questions
1. [First question that needs an answer]
2. [Second question if applicable]

### Context Collected So Far
- **Task**: [Task ID and title if retrieved]
- **Files Identified**: [List of files found]
- **Preliminary Findings**: [Any observations made before hitting the blocker]

### Next Steps
To continue this review:
1. Get answers to the questions above from the user
2. Re-run this skill with: `/issue-implementation-review [Task ID] --context "[answers and any additional context]"`
```

### When to Return Early

- Task ID is missing or invalid
- Multiple tasks match ambiguous criteria
- Implementation approach is unclear and critical to the review
- You find conflicting requirements that need human judgment

## Review Process

### 1. Gather Issue Context

Retrieve the full context for the implemented task:

- **Get the task**: Use `get_issue` to retrieve the task details, including:
  - Task description and requirements
  - Modified files list (tracked during implementation)
  - Implementation log entries
- **Get parent context**: Retrieve the parent feature (and epic/project if relevant) to understand broader requirements and acceptance criteria
- **Note the scope**: Understand what was requested vs. what should have been delivered

### 2. Review Changed Files

For each file listed in the task's modified files:

- **Read the file**: Examine the actual code changes
- **Understand the changes**: What was added, modified, or removed?
- **Check related files**: Look at imports, tests, and integration points

### 3. Correctness Review

Verify the implementation is technically correct:

- **Logic correctness**: Does the code do what it's supposed to do?
- **Error handling**: Are edge cases and errors handled appropriately?
- **Integration**: Does it integrate correctly with existing code?
- **Pattern consistency**: Does it follow codebase conventions and patterns?
- **Type safety**: Are types correct and complete (no `any` abuse)?
- **Security**: No obvious vulnerabilities (injection, XSS, etc.)?

### 4. Completeness Review

Verify all requirements are addressed:

- **Functional requirements**: All requirements from the task are implemented
- **Acceptance criteria**: Parent feature/epic criteria that apply are satisfied
- **Test coverage**: Tests exist for the new functionality
- **Quality checks**: Code passes linting, formatting, and type checks

### 5. Simplicity Review

Evaluate for over-engineering:

- **YAGNI violations**: Features or abstractions not required by the task
- **Premature optimization**: Performance optimizations without evidence of need
- **Unnecessary complexity**: Could this be simpler while still meeting requirements?
- **Scope creep**: Changes beyond what was requested (unless explicitly justified)
- **Dead code**: Unused imports, variables, or functions
- **Over-abstraction**: Helpers or utilities for one-time operations

**Guideline**: Three similar lines of code is often better than a premature abstraction.

### 6. Documentation Review

Evaluate code documentation:

- **Over-documentation**: JSDoc/docstrings on private or internal functions
- **Redundant documentation**: Comments that restate what the code shows (parameter types, return types, obvious behavior)
- **Verbose documentation**: Multi-paragraph docs where one sentence would suffice
- **Missing public docs**: Public interfaces without any documentation

**Guideline**: Documentation is for AI agents who have already read the code. If the documentation just restates what's visible in the signature and implementation, flag it for removal.

## Output

Return only actionable findings. Skip positive assessments, status indicators, and "everything looks good" observations. The output is consumed by AI agents that need to act on findings.

### Output Format

```
## Review Findings

### Critical (must fix)
- [file:line] [Specific issue that must be addressed before proceeding]

### Recommendations
- [file:line] [Suggested improvement with rationale]

### Gaps
- [Missing requirement or functionality from the task description]

### Questions
- [Item needing user clarification before review can complete]
```

### Output Rules

- **Omit empty sections**: If a section has no items, do not include it
- **No findings = approved**: If there are no findings, return only: `No issues found.`
- **No verdict section**: Empty output implicitly means approved
- **Always include file:line**: Reference specific code locations for all findings
- **Skip positive observations**: Do not report things that are correct or working well

### Examples

**When issues are found:**
```
## Review Findings

### Critical (must fix)
- src/auth/login.ts:45 Missing null check before accessing user.email
- src/auth/login.ts:78 SQL query vulnerable to injection, use parameterized query

### Recommendations
- src/auth/login.ts:23 Consider extracting validation logic to separate function for testability
```

**When no issues are found:**
```
No issues found.
```

## Review Standards

- **Evidence-based**: Support findings with specific code references (file:line)
- **Actionable**: Recommendations should be specific and implementable
- **Proportionate**: Don't nitpick style when substance matters more
- **Concise**: Only report items that require action or decision

## Cross-Task Coherence Review

When your task-list entry asks you to perform a **Cross-Task Coherence Review**, follow this section instead of the per-task review process above.

### Goal

Verify that the combined change set across all sibling tasks is internally consistent — no duplicate rules, no conflicting edits, no scope overlap, no broken shared invariants.

### Inputs

Your task-list entry provides:

- **Feature ID and title**: The shared parent feature.
- **Implemented task IDs**: The complete list of `T-xxx` tasks to review together.

### Process

#### 1. Gather the full sibling context

For each implemented task ID:

- Call `get_issue` to retrieve the task body, modified files, and implementation log.
- Read every file listed in the task's modified files.

Build a complete picture of: which files each task touched, what each task changed in those files, and what each task's stated scope was.

#### 2. Apply the coherence rubric

Evaluate the combined change set against the four categories below. For each finding, note the specific files and tasks involved.

**Duplicate rules**
Does any rule, constant, named behavior, or configuration value appear in more than one file, introduced by different tasks, in a way that could diverge over time? Examples: the same validation rule defined in two modules, the same default value hardcoded in two places, the same protocol step described twice in a SKILL.md.

**Conflicting edits**
Do any two tasks' changes contradict each other in the same file section? Examples: one task adds a rule saying "always X" and another adds a rule saying "never X" in the same instruction block; one task removes a constraint that another task relies on.

**Scope creep across tasks**
Did any task implement behavior that a sibling task was also supposed to own, creating unintended overlap? Examples: both tasks added handling for the same edge case independently, two tasks both modified the same section of a shared file beyond what their individual scopes required.

**Broken cross-task invariants**
Does the combined change set violate any invariant that held before the run? Examples: a shared protocol that both tasks touched in incompatible ways, a documented constraint in one task's changes that another task's changes silently break, a section-level structure (ordering, numbering, naming) that two tasks modified in incompatible ways.

#### 3. Produce findings

Use the same `## Review Findings` format as per-task reviews:

```
## Review Findings

### Critical (must fix)
- [file:line or task scope] [Specific cross-task issue that must be addressed]

### Recommendations
- [file:line or task scope] [Suggested improvement with rationale]

### Gaps
- [Cross-task requirement or consistency property that is missing]

### Questions
- [Item needing lead or user clarification]
```

Apply the same output rules: omit empty sections; if no findings, return only `No issues found.`

### Teammate Mode (coherence review)

When running as a teammate performing a coherence review:

- **Read-only**: Do NOT modify any files.
- **No new issues**: Do NOT create new Trellis issues.
- **Report to lead**: Send findings as a single `SendMessage` to the lead (not to individual developers — the lead decides how to route fixes). Do NOT mark the task-list entry done until the lead confirms findings are resolved or accepts the review.
- **Mark done**: When the lead confirms the review is complete, mark your task-list entry `done` via `TaskUpdate`.

---

## Teammate Mode

When running as a teammate inside an agent team:

- **Fix cycles**: Send all findings as a single `SendMessage` to the paired developer (developer name is in your task-list entry). Do NOT mark the review task-list entry done. Wait for the developer's fix notification, then re-review. Repeat until no critical findings remain.
- **Read-only**: Do NOT modify any files.
- **No new issues**: Do NOT create new Trellis issues. If findings fall outside the current task's scope, include them in your review message for the lead to decide.
- **Mark done**: When approved, mark your task-list entry `done` via `TaskUpdate`.
