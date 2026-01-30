# Requirements: Task Trellis Orchestration Enhancements

## Overview

Enhance the Task Trellis plugin's orchestration capabilities by adding intelligent review loops, automatic documentation maintenance, and a unified issue creation workflow. These changes transform the implementation flow from a simple sequential executor into a quality-aware orchestration system.

## Change 1: Update `issue-implementation` Orchestration

**File**: `plugins/task-trellis/skills/issue-implementation/orchestration.md`

### 1.1 Branch Creation

**What**: When orchestration starts and the current branch is `main`, create a feature branch before any implementation work begins.

**Behavior**:
- Check current git branch
- If on `main`, create and checkout `feature/{ISSUE_ID}` (e.g., `feature/F-add-user-auth` or `feature/E-auth-system`)
- If already on a non-main branch, continue without branching

### 1.2 Optional Implementation Planning

**What**: Before executing child tasks, the orchestrator evaluates complexity and optionally invokes `issue-implementation-planner` as an async subagent.

**Behavior**:
- Orchestrator assesses the feature/epic based on task descriptions, number of tasks, and scope indicators
- If judged sufficiently complex, spawn `issue-implementation-planner` as async subagent
- Planner output narrows down context needed by implementation agents
- This is a judgment call—no hard threshold

**Complexity signals to consider**:
- Multiple integration points
- Tasks spanning multiple subsystems
- Refactoring or migration language
- Architectural changes

### 1.3 Per-Task Review Cycle

**What**: After each task is implemented, spawn `issue-implementation-review` as an async subagent (skippable for trivial tasks).

**Behavior**:
- After task implementation completes, orchestrator evaluates if review is warranted
- For non-trivial tasks: spawn async subagent running `issue-implementation-review`
- Trivial tasks (judgment call: single config change, one-line fix, etc.) may skip review
- Wait for review to complete before proceeding

**Review outcomes**:
- **No findings**: Proceed to commit
- **Minor issues**: Auto-fix and proceed
- **Major issues**: Pause, ask user how to proceed
- **Questions requiring answers**: Pause orchestration, get user answers, re-run review

### 1.4 Per-Task Commits

**What**: Commit changes after each task is implemented and reviewed (if review ran).

**Behavior**:
- After task implementation and review pass, commit the changes
- Commit message references the task ID and summarizes the work
- Continue to next task only after successful commit

### 1.5 Documentation Update on Feature Completion

**What**: When all tasks are complete, invoke `docs-updater` skill before marking feature done.

**Behavior**:
- After all child tasks completed and committed
- Spawn `docs-updater` as async subagent
- Wait for docs-updater to complete
- Commit any documentation changes
- Only then mark feature as done and report completion

---

## Change 2: New `docs-updater` Skill

**File**: `plugins/task-trellis/skills/docs-updater/SKILL.md` (new)

### Purpose

Review completed feature work and update documentation files as needed. This skill is invoked after implementation is complete and before the feature is marked done.

### Responsibilities

Maintain these documentation files:
- `CLAUDE.md` (project instructions for Claude)
- `README.md` (project readme)
- `docs/**` (any files in docs folder)

### Behavior

1. Review the changes made during the feature implementation (git diff, modified files list)
2. Analyze if any documented behaviors, APIs, configurations, or usage patterns have changed
3. Determine which documentation files need updates
4. Make the necessary documentation updates directly
5. Return summary of changes made (or "no updates needed")

### Skill Properties

- `context: fork` (runs as subagent)
- `agent: general-purpose`
- Read-only tools plus Edit/Write for documentation files
- Access to git diff to understand what changed

---

## Change 3: New `issue-creation-orchestration` Skill

**File**: `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md` (new)

### Purpose

Wrapper skill that orchestrates issue creation with automatic review. Ensures created issues are verified against original requirements.

### Behavior

1. **Capture original input**: Explicitly capture the exact user instructions/requirements at the start
2. **Invoke issue creation**: Direct the main agent to use `issue-creation` skill per user's instructions
3. **Spawn review**: After issues are created, spawn `issue-creation-review` as async subagent
4. **Pass original context**: Provide the review agent with the exact original user input (not a summary) so it can verify against what was actually requested
5. **Handle review results**:
   - If review passes: Report success
   - If review has questions: Surface questions to user, get answers, re-run review with answers
   - If review finds issues: Report findings, let user decide how to address

### Key Requirement

The original user instructions must be preserved verbatim and passed to the review agent. The orchestrator must not paraphrase or summarize in a way that could mislead the reviewer about what was actually requested.

### Skill Properties

- Runs in main conversation (not forked)
- Uses `issue-creation` skill for actual creation
- Spawns `issue-creation-review` as async subagent
- Has AskUserQuestion for handling review questions

---

## Change 4: Update `implementation-review` Output Format

**File**: `plugins/task-trellis/skills/issue-implementation-review/SKILL.md`

### What

Change the output format to be actionable-only, since AI agents consume this output.

### Current Behavior

Returns a full report with sections for correctness assessment, completeness assessment, simplicity assessment, code quality, recommendations, and verdict.

### New Behavior

Return only items that require action:
- **Critical issues**: Must be fixed before proceeding
- **Recommendations**: Suggested improvements
- **Gaps**: Missing functionality or requirements
- **Questions**: Items needing clarification from user

**No verdict section**. If the output is empty (no findings), that implicitly means approved.

Skip:
- "Everything looks good" observations
- Positive assessments that don't require action
- Status indicators for things that passed

### Output Format

```
## Issues Found

### Critical (must fix)
- [Issue with file:line reference and specific problem]

### Recommendations
- [Suggested improvement with rationale]

### Gaps
- [Missing requirement or functionality]

### Questions
- [Item needing user clarification]
```

If no issues found, return a brief acknowledgment like "No issues found." (or empty response—to be determined by implementation).

---

## Done Criteria

### Change 1 (orchestration.md)
- [ ] Creates `feature/{ISSUE_ID}` branch when starting from main
- [ ] Evaluates complexity and optionally invokes planner as async subagent
- [ ] Spawns implementation review after each non-trivial task
- [ ] Auto-fixes minor review findings, escalates major ones to user
- [ ] Pauses for user input when review has questions
- [ ] Commits after each task is implemented and reviewed
- [ ] Invokes docs-updater before marking feature complete
- [ ] Waits for docs-updater before reporting done

### Change 2 (docs-updater)
- [ ] Skill file created with proper frontmatter
- [ ] Reviews git diff / modified files from feature work
- [ ] Identifies which docs need updates (CLAUDE.md, README.md, docs/)
- [ ] Makes documentation updates directly
- [ ] Returns summary of changes or "no updates needed"

### Change 3 (issue-creation-orchestration)
- [ ] Skill file created with proper frontmatter
- [ ] Captures original user input verbatim
- [ ] Directs use of issue-creation skill
- [ ] Spawns issue-creation-review as async subagent with original input
- [ ] Handles review questions by getting user answers and re-running
- [ ] Reports review findings to user

### Change 4 (implementation-review output)
- [ ] Output format updated to actionable-only structure
- [ ] Removes verdict section
- [ ] Removes positive/passing assessments
- [ ] Empty output = implicitly approved
- [ ] Retains: critical issues, recommendations, gaps, questions
