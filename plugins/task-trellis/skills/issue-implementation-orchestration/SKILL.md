---
name: issue-implementation-orchestration
description: Orchestrates implementation of a feature's tasks with parallel execution, automatic review, and a single commit. Use when asked to "implement feature", "execute feature", "implement tasks", or when you want task implementations automatically reviewed and committed.
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
  - TaskOutput
  - TaskStop
  - Skill
  - Glob
  - Grep
  - Read
  - Bash
  - AskUserQuestion
---

# Orchestrate Feature Implementation

Orchestrate the implementation of a feature by executing its tasks in parallel where dependencies allow, reviewing each implementation, and committing all approved changes in a single commit at the end.

When no feature is specified, this skill can also orchestrate one or more standalone tasks directly.

## Goal

Complete all planned tasks by:
1. Spawning task implementations via the `issue-implementation` skill (in parallel where dependencies allow)
2. Reviewing completed work via the `issue-implementation-review` skill
3. Updating documentation when all tasks are complete
4. Committing all changes in a single commit

## Subagent Spawn Protocol

All new subagent spawns (via the Task tool) that must invoke a skill MUST follow this protocol. This applies to implementation, review, planner, and documentation agents. It does NOT apply to resumed agents (via the `resume` parameter), which already have the skill loaded from their prior execution.

### Skill Invocation Preamble

Prepend the following preamble to EVERY new subagent prompt, substituting `[SKILL_NAME]` with the fully-qualified skill name (e.g., `task-trellis:issue-implementation`):

```
MANDATORY FIRST ACTION: Your very first action MUST be to use the Skill tool to invoke
the [SKILL_NAME] skill. Do NOT read files, do NOT search code, do NOT analyze anything,
do NOT take ANY other action before invoking this skill. The skill contains your complete
workflow and instructions.

If you encounter ANY errors invoking the skill (permission denied, skill not found, tool
not available, or any other error), STOP IMMEDIATELY and report the exact error back. Do
NOT attempt workarounds. Do NOT try to perform the task without the skill.
```

This preamble MUST appear at the START of the prompt, BEFORE any context, task details, or other instructions. The task-specific content (issue ID, context, plan) follows after the preamble.

### Verify Skill Invocation

Subagents sometimes ignore skill invocation instructions and attempt the task ad-hoc, producing inconsistent and unreliable results. To catch this early:

1. **Launch all new subagents with `run_in_background: true`** to enable output inspection before the agent finishes
2. **Peek at early output** shortly after launch using `TaskOutput` with `block: false`:
   - If the output shows the Skill tool being invoked → the agent is on track. Proceed to wait for completion with `TaskOutput` (`block: true`)
   - If the output shows the agent doing other work (reading files, searching code, writing code, calling MCP tools) WITHOUT having first invoked the Skill tool → the agent ignored the instruction
   - If the output is empty → the agent hasn't started yet. Wait a moment and peek again
3. **Kill non-compliant agents** immediately with `TaskStop` and spawn a replacement agent with the identical prompt
4. **Retry limit**: If the replacement agent also fails to invoke the skill, STOP and report the issue to the user — there is likely a permission or configuration problem preventing skill invocation

<rules>
  <critical>ALWAYS prepend the Skill Invocation Preamble to new subagent prompts — no exceptions</critical>
  <critical>ALWAYS peek at early output of background subagents to verify skill invocation</critical>
  <critical>KILL and replace any subagent that starts working without invoking its skill</critical>
  <critical>STOP and escalate to the user if two consecutive agents fail to invoke the skill</critical>
</rules>

## Process

**Note**: All subagent spawns in this process must follow the Subagent Spawn Protocol above. Every prompt template below shows only the task-specific content — you must prepend the Skill Invocation Preamble to each one.

### 1. Identify Work

#### Input

`$ARGUMENTS` - Can specify:

- **Feature ID**: A feature whose tasks should be implemented (e.g., "F-xxx")
- **Task ID(s)**: One or more specific tasks to implement (e.g., "T-xxx")
- **Scope**: Limit search to issues within a parent scope

Use `get_issue` to retrieve the issue details. If a feature ID is given, use `list_issues` to find its child tasks. If no ID is specified, use `get_next_available_issue` with `issueType: "feature"` to find the next available feature.

### 2. Create Feature Branch

Before starting implementation, ensure work is on a feature branch.

#### Check Current Branch

Use Bash to check the current branch:

```bash
git branch --show-current
```

#### Branch Logic

- **If on `main`**: Create and checkout a feature branch:
  ```bash
  git checkout -b feature/{ISSUE_ID}
  ```
  Example: `feature/F-add-user-auth`

- **If already on a non-main branch**: Continue without branching

### 3. Verify Tasks Exist

**CRITICAL**: Before starting, verify tasks are planned.

1. If working from a **feature**: Use `list_issues` to get all tasks under the feature
2. If working from **standalone tasks**: Use `get_issue` to verify each task exists and is actionable

**If tasks are missing or the feature has no tasks:**

- **STOP immediately**
- Inform the user that the work has no planned tasks
- Ask the user to complete the planning before proceeding
- **Do NOT create tasks yourself** — planning must happen before orchestration begins

**Note**: This restriction is about primary work planning. Follow-up work discovered *during* implementation can and should be tracked (see section 6.5).

### 4. Evaluate Complexity and Plan (Optional)

Before executing tasks, evaluate whether the work would benefit from upfront planning.

#### Complexity Signals

Consider spawning a planner for work with:

- **Multiple tasks** (more than 3-4 tasks)
- **Refactoring or migration** language in task descriptions
- **Architectural changes** mentioned
- **Multiple integration points** or subsystems involved
- **Cross-cutting concerns** that affect multiple areas

This is a judgment call—no hard threshold required.

#### Spawn Implementation Planner

If judged sufficiently complex:

1. Use the `Task` tool to spawn `issue-implementation-planner` as an async subagent:
   ```
   Task tool parameters:
   - subagent_type: "general-purpose"
   - description: "Plan implementation for {ISSUE_ID}"
   - run_in_background: true
   - prompt: |
       Use the /issue-implementation-planner skill to create an implementation plan for {ISSUE_ID}.

       Issue: {ISSUE_ID} - {ISSUE_TITLE}
       Description: {ISSUE_DESCRIPTION}

       Tasks to implement:
       {LIST_OF_TASKS_WITH_DESCRIPTIONS}

       Create a comprehensive plan that identifies key files, patterns, and implementation approach.
   ```

2. Use `TaskOutput` to wait for the planner to complete
3. Store the planner's output as context for implementation agents
4. Include relevant plan context when spawning task implementations

### 5. Determine Execution Order

Analyze the tasks to determine the correct execution order:

1. **Check prerequisites**: Each task may have `prerequisites` listing IDs that must complete first
2. **Check status**: Skip tasks that are already `done` or `wont-do`
3. **Build execution queue**: Order tasks so all prerequisites are satisfied before each runs

**Execution Rules:**

- A task can only start when ALL its prerequisite issues are `done`
- Tasks with no unmet prerequisites can run **in parallel**
- As each task completes and passes review, check if new tasks are now unblocked and launch them
- Continue until all tasks are complete and reviewed
- **Do NOT commit between tasks** — all changes are committed together at the end (see Section 9)

### 6. Execute Tasks

Launch all ready tasks (those with no unmet prerequisites) in parallel. As each task completes and passes review, check if new tasks are now unblocked and launch them. Repeat until all tasks are done.

For each task:

#### 6.1 Verify Task is Ready

- Check all prerequisites are `done`
- Check task status is `open` or `draft` (not already `in-progress` or `done`)
- If not ready, skip and check next task

#### 6.2 Launch Task Implementation

Use the `Task` tool to spawn subagents that implement ready tasks. **Launch multiple ready tasks in parallel** using `run_in_background: true` for all of them.

**CRITICAL**: Store the agent ID returned by the Task tool for each task. You will need these IDs to resume agents if review feedback requires changes.

Spawn the `issue-implementation` skill:
```
Task tool parameters:
- subagent_type: "general-purpose"
- description: "Implement task [TASK_ID]"
- prompt: |
    Use the /issue-implementation skill to implement task [TASK_ID].

    Context:
    - Parent: [PARENT_ID] - [PARENT_TITLE]
    - Task: [TASK_ID] - [TASK_TITLE]

    [INCLUDE_PLAN_CONTEXT_IF_AVAILABLE]

    Implement this task following the task implementation workflow.
    Do NOT commit your changes - leave them uncommitted for review.

    If you encounter any errors or blockers, STOP and report back.
```

After the Task tool returns, note the agent ID from the response (e.g., `agent_id: "abc123"`). You will use this with the `resume` parameter if the review identifies issues.

#### 6.3 Verify Task Completion

As each subagent returns (use `TaskOutput` with `block: false` to poll, or `block: true` to wait):

1. Use `get_issue` to check the task's status
2. If status is `done`: Continue to review step
3. If status is NOT `done`: Handle the error (see Section 7). Other parallel tasks may continue running.

#### 6.4 Review Task Implementation

After a task completes successfully, evaluate if a review is warranted.

**Skip review for trivial tasks** (judgment call):
- Single configuration change
- One-line fix
- Simple rename or move

**For non-trivial tasks**, spawn `issue-implementation-review`:

```
Task tool parameters:
- subagent_type: "general-purpose"
- description: "Review implementation of [TASK_ID]"
- run_in_background: true
- prompt: |
    Use the /issue-implementation-review skill to review task [TASK_ID].

    Task: [TASK_ID] - [TASK_TITLE]
    Parent Feature: [PARENT_ID] - [PARENT_TITLE]

    Review the implementation for correctness, completeness, and simplicity.
```

Use `TaskOutput` to wait for the review to complete.

**Handle review outcomes:**

- **No findings / empty output**: Task is approved. Check for newly unblocked tasks to launch.
- **Findings identified**: Resume the original implementation agent to address the feedback:
  1. **Resume the implementation agent** using the Task tool with the `resume` parameter:
     ```
     Task tool parameters:
     - subagent_type: "general-purpose"
     - description: "Address review feedback for [TASK_ID]"
     - resume: "[AGENT_ID_FROM_STEP_6.2]"
     - prompt: |
         The review identified the following issues that need to be addressed:

         [PASTE_REVIEW_FINDINGS_HERE]

         Please address ALL findings:
         - Fix valid findings, including minor ones (documentation, style, small improvements)
         - If you believe a finding is incorrect, explain your reasoning. You must justify skipping any finding.

         Do NOT commit your changes - leave them uncommitted for re-review.
     ```
  2. **Wait for the agent to complete** the fixes
  3. **Re-run review** to verify the findings were addressed
  4. **Repeat** this cycle until all valid findings are resolved
  5. **Task is approved** when the review passes. Check for newly unblocked tasks to launch.
- **Questions requiring answers**:
  - **STOP** orchestration
  - Use `AskUserQuestion` to get answers from the user
  - Resume the implementation agent with the answers provided

**CRITICAL - Orchestrator Role**: The orchestrator does NOT write code. It only orchestrates:
- Spawning implementation agents (in parallel where dependencies allow)
- Spawning review agents
- Sending feedback to implementation agents for fixes
- Committing all approved changes together at the end

If fixes are needed, ALWAYS resume the original implementation agent. The original agent already has full context about what it implemented, making it far more efficient than spawning a new agent that would need to rebuild context.

**CRITICAL**: Do not categorize findings as "minor" and skip them. Every finding from a review must be either fixed or explicitly challenged with reasoning. Ignoring feedback is not acceptable.

#### 6.5 Handle Follow-up Work

During implementation or review, you may identify work that wasn't originally planned but should be addressed. Rather than just noting "this needs follow-up," take action to ensure follow-up actually happens.

**When follow-up work is identified:**

1. **Search for existing coverage** before creating anything:

   a. **Check for existing issues** that cover this work:
   ```
   Use list_issues to search for issues that might already cover this work:
   - Search by relevant keywords in titles
   - Check both open issues AND recently completed issues
   - Look in the current feature's siblings and parent hierarchy
   ```

   b. **Check planned but unstarted work** in the current project/epic:
   - Review other features under the same epic
   - Review other tasks under sibling features
   - The work might already be planned for a later phase

   c. **If already covered**: Log the discovery and reference the existing issue, then move on

2. **If genuinely new work** that isn't covered elsewhere:

   a. **Determine the appropriate parent**:
   - **Preferred**: Add to the current feature (if still open or can be reopened)
   - **Alternative**: Add to a sibling feature that's still open
   - **Fallback**: Create as a standalone task (no parent)

   b. **Handle completed parent features**:
   - If the current feature is marked `done`, use `update_issue` to change its status back to `open`
   - Log why the feature was reopened: "Reopened to add follow-up task discovered during implementation"
   - This is acceptable—features can be reopened when new work is discovered

   c. **Create the follow-up task** using the issue-creation skill:
   ```
   Invoke the Skill tool:
   - skill: "task-trellis:issue-creation"
   - args: "Create a task under [PARENT_ID]: [DESCRIPTION_OF_FOLLOW_UP_WORK]"
   ```

3. **What qualifies as follow-up work:**
   - Technical debt discovered during implementation
   - Edge cases not covered by original requirements
   - Refactoring opportunities that would improve maintainability
   - Missing tests or documentation identified during review
   - Integration issues that need separate attention
   - Performance improvements identified but out of scope for current task

4. **What does NOT require follow-up tasks:**
   - Items that should be addressed in the current task (don't defer unnecessarily)
   - Known limitations that are explicitly acceptable
   - "Nice to have" improvements with no real impact
   - Stylistic preferences that don't affect functionality

**CRITICAL**: The goal is ensuring follow-up work actually gets tracked—not just mentioned. If you identify something that genuinely needs to be done later, create the issue. But always search first to avoid duplicates.

### 7. Handle Errors

<rules>
  <critical>If you encounter a permission error, STOP IMMEDIATELY and report to the user. Do NOT attempt workarounds.</critical>
  <critical>NEVER debug or fix code issues yourself - always send them back to the implementation agent.</critical>
  <critical>NEVER work around errors by skipping steps, using alternative approaches, or ignoring validation failures.</critical>
  <critical>When blocked by infrastructure errors (not code issues) - your only options are: (1) ask the user for help, or (2) stop completely.</critical>
</rules>

#### Error Classification

**Implementation errors** (send back to the implementation agent):
- Failing tests or smoke tests
- Linting or formatting errors
- Type errors or compilation failures
- Pre-commit hook failures due to code quality
- Runtime errors in the implemented code
- Any error caused by code the implementation agent wrote

**Infrastructure errors** (stop and ask the user):
- Permission denied when running commands
- Missing dependencies or tools
- Network/connectivity issues
- Git configuration problems
- Environment setup issues

#### Handling Implementation Errors

When an error is caused by the implementation agent's work:

1. **Resume the implementation agent** with the error details:
   ```
   Task tool parameters:
   - subagent_type: "general-purpose"
   - description: "Fix error for [TASK_ID]"
   - resume: "[AGENT_ID_FROM_STEP_6.2]"
   - prompt: |
       An error occurred that needs to be fixed:

       [PASTE_FULL_ERROR_OUTPUT_HERE]

       Please diagnose and fix this issue. The error is related to code you implemented.

       After fixing, verify the fix works, then report back.
       Do NOT commit - leave changes uncommitted.
   ```

2. **Wait for the fix** and re-attempt the failed operation

3. **Repeat if needed** - If new errors occur, send them back to the agent

4. **Escalate to user** only if the agent cannot resolve the issue after reasonable attempts

#### Handling Infrastructure Errors

For errors NOT caused by the implementation:

1. **Stop execution** - Do not proceed to other tasks
2. **Ask the user** - Use AskUserQuestion to report the failure and ask how to proceed:
   - Fix the infrastructure issue and retry
   - Skip the failed task and continue
   - Stop orchestration entirely
3. **Follow user direction** - Do what the user decides

**CRITICAL - Orchestrator Role**: The orchestrator NEVER debugs code, reads stack traces to diagnose issues, or attempts fixes. When something fails due to code, the orchestrator's only job is to send the error back to the implementation agent that wrote the code.

**Why this matters**: Hooks are configured to enforce quality checks and validation rules. When they fail, it usually means something is misconfigured or you lack necessary permissions. Working around these errors masks important problems and can lead to broken code being committed.

### 8. Update Documentation

When all tasks are done (before committing):

#### Spawn Documentation Updater

Use the `Task` tool to spawn `docs-updater`:

```
Task tool parameters:
- subagent_type: "general-purpose"
- description: "Update documentation for [ISSUE_ID]"
- run_in_background: true
- prompt: |
    Use the /docs-updater skill to review and update documentation.

    Issue: [ISSUE_ID] - [ISSUE_TITLE]

    Review the changes made during this implementation and update any relevant
    documentation files (CLAUDE.md, README.md, docs/**).
```

Use `TaskOutput` to wait for the docs-updater to complete.

Documentation changes will be included in the single commit in step 9.

### 9. Commit All Changes and Complete

When all tasks are done, reviewed, and documentation is updated:

1. Verify all tasks have status `done` (or `wont-do` if skipped by user direction)
2. **Update Trellis state**: Ensure all tasks are marked complete via `complete_task`, then update the feature status (if applicable) to `done` using `update_issue`
3. **Commit ALL changes** (implementation, documentation, and `.trellis/` state) in a single commit using the `/git:commit` skill (if available) or manually:

   **Using the skill** (preferred):
   ```
   /git:commit feat: implement [ISSUE_ID] - [ISSUE_TITLE]
   ```

   **Manual fallback** (if skill unavailable):
   ```bash
   git add .
   git commit -m "feat: implement [ISSUE_ID] - [ISSUE_TITLE]"
   ```

4. **Handle commit failures** — If the commit fails (e.g., pre-commit hook, smoke test, linting):

   **CRITICAL**: Do NOT debug or fix the issue yourself. Identify which task's code caused the failure and resume that task's implementation agent:
   ```
   Task tool parameters:
   - subagent_type: "general-purpose"
   - description: "Fix commit failure for [TASK_ID]"
   - resume: "[AGENT_ID_FOR_FAILING_TASK]"
   - prompt: |
       The commit failed with the following error:

       [PASTE_FULL_ERROR_OUTPUT_HERE]

       Please fix the issue that caused this failure. Common causes include:
       - Failing tests or smoke tests
       - Linting errors
       - Type errors
       - Pre-commit hook violations

       After fixing, verify the fix works locally, then report back.
       Do NOT commit - leave changes uncommitted.
   ```

   After the agent fixes the issue:
   - Re-attempt the commit
   - If it fails again, resume the appropriate agent with the new error
   - Repeat until the commit succeeds

5. **Verify commit succeeded** and no uncommitted changes remain
6. Report summary to user:
   - Total tasks completed
   - Any tasks skipped
   - Commits created
   - Documentation updates made
   - Overall outcome

### 10. Summarize Expected Changes for User

After completing the work, provide a clear summary of what the user should expect to see now that this work is complete. This is the most important output for the user.

#### What Changed Summary

Provide a concise description of what's different now:

1. **New capabilities**: What can the user (or the system) do now that wasn't possible before?
2. **Behavior changes**: What existing functionality works differently?
3. **Files affected**: High-level summary of which areas of the codebase were touched (not exhaustive file lists)

#### How to Verify

Tell the user how they can see the changes in action:

1. **For UI changes**: Describe where to look and what they'll see
2. **For API changes**: Example commands or endpoints to test
3. **For CLI changes**: Commands to run
4. **For configuration**: What settings are now available
5. **For internal refactors**: How to verify the code still works (e.g., "run the test suite")

#### Example Summary Format

```
## What's New

[FEATURE_TITLE] is now complete. Here's what changed:

**New Capabilities:**
- [Describe what users can now do]
- [Any new commands, endpoints, or UI elements]

**Key Changes:**
- [Brief description of the main implementation approach]
- [Any notable architectural decisions]

**How to Verify:**
- [Specific steps to see the feature in action]
- [Commands to run, URLs to visit, or actions to take]

**Files Changed:**
- [Area 1]: [Brief description of changes]
- [Area 2]: [Brief description of changes]
```

#### Why This Matters

The user initiated this work to achieve a specific outcome. They need to know:
- That the work is actually complete
- What they can do with it now
- How to verify it works as expected

A summary of commits and task counts is process information. The user needs **outcome information**—what's different in their codebase and how to use it.

## Important Constraints

- **Orchestration only**: The orchestrator does NOT write code, debug errors, or make fixes. It only spawns agents, routes feedback/errors, and commits approved changes.
- **Resume for feedback**: When review identifies issues, ALWAYS resume the original implementation agent rather than spawning a new one. The original agent has context and can address feedback efficiently.
- **Resume for errors**: When commit hooks, tests, or other validations fail due to code issues, ALWAYS resume the original implementation agent with the error. Never debug or fix code yourself.
- **Parallel execution**: Launch tasks in parallel when their prerequisites are satisfied. Do NOT wait for one task to finish before launching another independent task.
- **Single commit**: Do NOT commit after each task. All changes (implementation, documentation, `.trellis/` state) are committed together in a single commit at the end (Section 9).
- **Follow-up work only**: Create new issues only for follow-up work discovered during implementation—never for the primary work (see section 6.5)
- **Respect dependencies**: Never start a task before its prerequisites are done
- **Stop on infrastructure failure**: Stop and ask user only for infrastructure errors (permissions, missing tools, network). Code errors go back to the implementation agent.
- **Ask questions**: Use AskUserQuestion when uncertain about anything
- **Trellis before commits**: Always update Trellis issues BEFORE making git commits
- **Update docs before completing**: Always run docs-updater before marking the feature as done
- **No uncommitted Trellis state**: Never finish with uncommitted `.trellis/` changes

<rules>
  <critical>The orchestrator does NOT write code or debug errors - it only orchestrates agents and commits</critical>
  <critical>ALWAYS resume the original implementation agent when review finds issues - never spawn a new agent or fix code yourself</critical>
  <critical>ALWAYS resume the original implementation agent when commits fail due to code issues (tests, hooks, linting) - never debug yourself</critical>
  <critical>NEVER read stack traces, analyze errors, or attempt to diagnose code problems - send them to the implementation agent</critical>
  <critical>STOP only for infrastructure errors (permissions, missing tools) - code errors go back to the implementation agent</critical>
  <critical>Do NOT commit between tasks - all changes are committed in a single commit at the end (Section 9)</critical>
  <critical>Launch independent tasks in parallel - do NOT execute sequentially when dependencies allow parallelism</critical>
  <critical>Update Trellis issues BEFORE git commits so .trellis/ changes are included</critical>
  <critical>Never leave .trellis/ changes uncommitted when finishing work</critical>
  <critical>Address ALL review findings - do not ignore feedback because it seems minor</critical>
  <critical>If you skip a review finding, you MUST explain why you believe it is incorrect</critical>
  <critical>When follow-up work is identified, ALWAYS search for existing coverage first - never create duplicates</critical>
  <critical>Create follow-up tasks to track genuinely new work - don't just mention it and move on</critical>
</rules>
