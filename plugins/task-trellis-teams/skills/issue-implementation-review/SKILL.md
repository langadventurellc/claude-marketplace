---
name: issue-implementation-review
description: Reviews code changes from a completed task implementation for correctness, completeness, and simplicity. Use when asked to "review implementation", "review task code", "code review", "verify implementation", or after completing an issue implementation.
allowed-tools:
  - AskUserQuestion
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

If the task ID is missing or ambiguous, multiple tasks match, the implementation approach is unclear and critical to the review, or you find conflicting requirements that need human judgment, ask the user before proceeding. Do not make assumptions.

## Review Process

**Working-tree changes from sibling tasks may be present; scope your diff to this task's `modifiedFiles`. Cross-reference sibling `modifiedFiles` before flagging out-of-scope edits.**

### 1. Gather Issue Context

Retrieve the full context for the implemented task:

- **Get the task**: Use `get_issue` to retrieve the task details, including:
  - Task description and requirements
  - Modified files list (tracked during implementation)
  - Implementation log entries
- **Get parent context**: Retrieve the parent feature (and epic/project if relevant) to understand broader requirements and acceptance criteria
- **Note the scope**: Understand what was requested vs. what should have been delivered

### 2. Review Changed Files

In a multi-task run the working tree may contain changes from sibling tasks on the same branch. Scope your review to the files this task actually changed:

1. Run `git diff --stat <base-branch>` to see the full branch diff. Compare this output against the task's `modifiedFiles` list.
2. For each file in `modifiedFiles`: run `git diff <base-branch> -- <file>` to see only that file's changes, then `Read` the full file for context.
3. **Flag mismatches**: If a file appears in `git diff --stat` output but is absent from `modifiedFiles`, that is a blocking finding — the developer self-report is incomplete. If a file is in `modifiedFiles` but has no diff, note it (may indicate a no-op or stale entry).

These commands cover tracked-file changes whether committed or not. The three-dot `<base>...HEAD` form skips the working tree and returns empty when the developer left changes uncommitted — do not use it. Run `git status --short` and `Read` any untracked files directly; `git diff` does not list them.

Do NOT review files outside `modifiedFiles` as part of this task's correctness check. Off-scope files may have been changed by sibling tasks and are not your responsibility here.

> **Note**: The base branch is typically `main`; determine it via `git symbolic-ref refs/remotes/origin/HEAD` or by checking `git log --oneline` context.

#### Scope-creep tolerance

When a file in `modifiedFiles` contains changes beyond what the task description requires, apply this rule:

- **Block** when off-scope changes introduce new behavior, alter correctness, or contradict a sibling task's scope.
- **Note (Recommendations)** when off-scope changes are minor and low-risk (e.g., a typo fix or a formatting correction the developer made while in the file).
- **Ignore** when the off-scope change is trivially correct and the developer did not claim it as part of their scope (no mention in the task summary or log).

Always confirm the off-scope change is not already owned by a sibling task before flagging it.

#### Terminology and consistency tasks

If the task's goal is to rename a term, align a phrase across files, or enforce a consistency rule, do NOT trust the `modifiedFiles` list alone. Run `Grep` across the full working-tree diff for the old term and the new term to verify the rename is complete. A missed occurrence not listed in `modifiedFiles` is a blocking finding (the developer omitted a changed file from their self-report).

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
- **Test suite**: Run the project's test suite via `Bash` before approving WHEN a project-standard test command exists (e.g., `npm test`, `pytest`, `go test ./...`, or one documented in README/CLAUDE.md/package.json). Report the pass/fail count in your findings (or as a Note on approval). A failing test on non-trivial logic is a Critical finding. If no test command is discoverable, record a Note in the review (e.g., "no test suite detected") and proceed. Projects without tests (e.g., plugin marketplaces, docs-only repos) are NOT a blocker for approval.

### 5. Attachment-Conformance Review

When the task body includes an `## Attachments` section, read each referenced file directly from its on-disk path (cited in the task body — no `get_issue` round-trip required) and verify the implementation reflects the source material.

**Four conformance checks:**

1. **Design-file conformance**: When a design file is referenced, the implementation visually and structurally matches it. Flag concrete divergences (layout, component structure, color, typography) rather than vague style concerns.

2. **Asset reuse**: When an existing stylesheet or asset is referenced as reusable, the implementation uses it rather than recreating a similar-but-different version. Duplicating a reusable asset is a defect, not a style choice.

3. **Spec-document satisfaction**: When a spec document is referenced, the implementation satisfies its stated requirements. Each requirement is either met or explicitly justified as out-of-scope in the developer's completion summary.

4. **Deviation justification**: When the developer's completion summary describes a deviation from an attached source material, the justification must be substantive (technical constraint, deliberate product decision). Vague or missing justification is a blocking finding.

**Blocking rule:**

Block when:

- The task had an `## Attachments` section AND the implementation does not reflect the attached materials AND the developer's completion summary provides no explanation.
- A reusable asset was explicitly referenced and the implementation recreated it instead of using it.

**Approved-with-note path:** A clear, substantive deviation justification from the developer converts a blocking finding into a non-blocking note.

### 6. Simplicity Review

Evaluate for over-engineering:

- **YAGNI violations**: Features or abstractions not required by the task
- **Premature optimization**: Performance optimizations without evidence of need
- **Unnecessary complexity**: Could this be simpler while still meeting requirements?
- **Scope creep**: Changes beyond what was requested (unless explicitly justified)
- **Dead code**: Unused imports, variables, or functions
- **Over-abstraction**: Helpers or utilities for one-time operations

**Guideline**: Three similar lines of code is often better than a premature abstraction.

### 7. Documentation Review

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

### Notes
- [Self-report or metadata gap — non-gating, does not trigger Reconciliation Pass]

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
- **Proportionate**: Don't nitpick style when substance matters more.
  - **Critical** = correctness failures, security vulnerabilities, completeness gaps, hard requirement gaps, dead code or unused symbols, duplicate logic that should be extracted to a shared module, cross-file or cross-task inconsistencies, stale or bit-rot references, missing unit tests on non-trivial logic, unresolved TODOs, or backwards-compat shims for unused code.
  - **Recommendations** = genuinely optional improvements: subjective style preferences, alternative refactor suggestions the developer may decline, minor nits that do not affect production readiness.
  - **Notes** = self-report or metadata gaps that do not affect the code or its correctness (e.g., missing `affectedFiles` entry on a scaffold task) — non-gating, do NOT trigger the Reconciliation Pass.
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
Does any rule, constant, named behavior, or configuration value appear in more than one file, introduced by different tasks, in a way that could diverge over time? Examples: the same validation rule defined in two modules, the same default value hardcoded in two places, the same protocol step described twice in a SKILL.md, the same helper function introduced independently by two tasks (duplicate logic that should instead be extracted to a shared module).

**Conflicting edits**
Do any two tasks' changes contradict each other in the same file section? Examples: one task adds a rule saying "always X" and another adds a rule saying "never X" in the same instruction block; one task removes a constraint that another task relies on.

**Scope creep across tasks**
Did any task implement behavior that a sibling task was also supposed to own, creating unintended overlap? Examples: both tasks added handling for the same edge case independently, two tasks both modified the same section of a shared file beyond what their individual scopes required.

**Broken cross-task invariants**
Does the combined change set violate any invariant that held before the run? Examples: a shared protocol that both tasks touched in incompatible ways, a documented constraint in one task's changes that another task's changes silently break, a section-level structure (ordering, numbering, naming) that two tasks modified in incompatible ways, a function removed by one task that another task's code still references (stale or bit-rot reference), a symbol introduced by one task but rendered unused by another task's changes (dead code created by the combined edit).

#### 3. Produce findings

Use the same `## Review Findings` format as per-task reviews:

```
## Review Findings

### Critical (must fix)
- [scope-tag] [file:line or task scope] [Specific cross-task issue that must be addressed]

### Recommendations
- [file:line or task scope] [Suggested improvement with rationale]

### Notes
- [Self-report or metadata gap — non-gating, does not trigger Reconciliation Pass]

### Gaps
- [Cross-task requirement or consistency property that is missing]

### Questions
- [Item needing lead or user clarification]
```

**Scope-tag convention (Critical findings only).** Every Critical finding MUST begin with one of these tags so the lead can mechanically triage between auto-remediation and user escalation:

- `[in-scope]` — The fix is a mechanical edit to files already modified by implemented tasks in this run. No new Trellis issues, no design decisions, no unmodified-file edits required. Examples: deleting dead code in a file already touched by this run, extracting a duplicate helper from already-modified files.
- `[requires-user-decision]` — The fix requires a design choice, policy judgment, or disambiguation of intent that a fresh developer should not make alone.
- `[out-of-scope]` — The fix requires changes to files not touched by this run, or implies work that would create new Trellis issues.

When in doubt between `[in-scope]` and `[requires-user-decision]`, prefer `[requires-user-decision]`. Tags apply to Critical findings only; Recommendations, Gaps, and Questions do not need them.

Apply the same output rules: omit empty sections; if no findings, return only `No issues found.`

### Teammate Mode (coherence review)

When running as a teammate performing a coherence review:

- **Read-only**: Do NOT modify any files.
- **No new issues**: Do NOT create new Trellis issues.
- **Report to lead**: Send findings as a single `SendMessage` to the lead (not to individual developers — the lead decides how to route fixes).
- **Fix cycles**: If your review produces Critical findings, do NOT mark the task-list entry done. Stay alive after sending findings to the lead. The lead will trigger a Reconciliation Pass and then nudge you to re-review with `"reconciliation changes applied — please re-review"`. Re-review against the new diff and repeat until no Critical findings remain.
- **Mark done**: Mark this task-list entry `completed` via `TaskUpdate` only on a clean review (no Critical findings).

---

## Teammate Mode

When running as a teammate inside an agent team:

- **Fix cycles**: Send all findings as a single `SendMessage` to the paired developer (developer name is in your task-list entry). Do NOT mark the review task-list entry done. Wait for the developer's fix notification, then re-review. Repeat until no critical findings remain.
- **Read-only**: Do NOT modify any files.
- **No new issues**: Do NOT create new Trellis issues. If findings fall outside the current task's scope, include them in your review message for the lead to decide.
- **Mark done**: When approved, mark your task-list entry `done` via `TaskUpdate`.
