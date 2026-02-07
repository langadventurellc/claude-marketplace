---
name: issue-creation-orchestration
description: Orchestrates issue creation with automatic review. Use when asked to "create and review issues", "create verified issues", or when you want issues automatically validated against requirements.
allowed-tools:
  - mcp__task-trellis__create_issue
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__update_issue
  - mcp__task-trellis__list_issues
  - mcp__perplexity-ask__perplexity_ask
  - Task
  - TaskOutput
  - TaskStop
  - Skill
  - AskUserQuestion
---

# Issue Creation with Review

Orchestrate issue creation with automatic review to ensure created issues accurately reflect the original requirements.

## Goal

Create Trellis issues using the `issue-creation` skill, then automatically verify them against the original requirements using `issue-creation-review`. Handle any questions or findings from the review before completing.

## Critical Rule: Create Only Immediate Children (One Level Down)

**When given a parent issue, create only its immediate children - ONE level down in the hierarchy.**

- For a **Project**: Create only Epics, then STOP
- For an **Epic**: Create only Features, then STOP
- For a **Feature**: Create only Tasks, then STOP

**Do NOT recursively decompose further.** If the user gives you a Project, create the Epics and stop. Do not continue to create Features or Tasks. The user will invoke this skill again on individual children if they want further decomposition.

## Subagent Spawn Protocol

All new subagent spawns (via the Task tool) that must invoke a skill MUST follow this protocol. This applies to issue creation and review agents. It does NOT apply to resumed agents (via the `resume` parameter), which already have the skill loaded and their behavioral guardrails from their agent type.

### Agent Types

Each subagent is spawned with a specific agent type that provides behavioral guardrails. The default agent types are:

| Role | Agent Type | Purpose |
|------|-----------|---------|
| Issue creation | `trellis-default-issue-writer` | Creating/updating Trellis issues |
| Review | `trellis-default-issue-writer` | Issue verification |

**Agent type configurability**: Users can override these defaults by specifying a different agent type in the spawn parameters. For example, a team could create a custom issue-writer agent with project-specific writing guidelines. The orchestration workflow remains the same regardless of which agent type is used.

### Skill Specification in Spawn Prompts

Every new subagent prompt MUST specify WHICH skill the agent should invoke. The agent's own system prompt already contains instructions on HOW to invoke skills (the Skill Invocation Mandate), so the spawn prompt only needs to name the skill.

## Autonomous Operation

**When given a parent issue ID** (e.g., "F-feature-id", "E-epic-id"), proceed directly to creating the immediate child issues (one level down) without asking for confirmation. The user has already decided they want child issues created by invoking this skill.

**Do not ask about granularity.** Default to coarser-grained issues - meaning fewer, larger issues at the level you're creating. This does NOT mean decomposing further down the hierarchy. Use your judgment to determine appropriate scope at the current level.

**Only ask clarifying questions when:**
- Requirements are genuinely ambiguous and could be interpreted multiple ways
- Critical information is missing that cannot be inferred from context
- A decision has significant irreversible consequences

Otherwise, make reasonable decisions and proceed.

## Input

`$ARGUMENTS` - The user's original requirements/instructions for issue creation

## Process

**Note**: All subagent spawns in this process must follow the Subagent Spawn Protocol above. Every prompt template below specifies which skill the agent must invoke — the agent's own system prompt handles the rest.

### 1. Capture Original Input

**CRITICAL**: Store the exact user instructions verbatim at the start.

```
Original User Requirements:
---
[EXACT_USER_INPUT_HERE]
---
```

This exact text will be passed to the review agent. Do not paraphrase, summarize, or modify it in any way. The reviewer needs the original requirements to verify the created issues accurately.

### 2. Spawn Issue Creation (One Level Only)

Spawn the `issue-creation` skill as a subagent to create the immediate child issues.

1. Determine the appropriate child issue type (one level down from parent)
   - Project parent → create Epics only
   - Epic parent → create Features only
   - Feature parent → create Tasks only

2. Spawn the issue creation agent:

```
Task tool parameters:
- subagent_type: "trellis-default-issue-writer"
- description: "Create child issues for [PARENT_ID]"
- run_in_background: true
- prompt: |
    Invoke the `issue-creation` skill with the following arguments.

    $ARGUMENTS:
    Parent: [PARENT_ID] - [PARENT_TITLE]
    Child type: [CHILD_ISSUE_TYPE] (one level down only)

    Original User Requirements (verbatim):
    ```
    [EXACT_ORIGINAL_INPUT_FROM_STEP_1]
    ```

    Create the immediate child issues only. Do NOT recursively decompose further.
    STOP after creating this level — do not continue to grandchildren.
```

3. Use `TaskOutput` to wait for the creation agent to complete
4. Track all created issue IDs and their types

**Record created issues:**
```
Created Issues:
- [ISSUE_ID]: [ISSUE_TYPE] - [TITLE]
- [ISSUE_ID]: [ISSUE_TYPE] - [TITLE]
```

### 3. Spawn Review for Created Issues

After all issues are created, spawn `issue-creation-review` as an async subagent to verify each issue.

For each created issue (or the top-level issue if creating a hierarchy):

```
Task tool parameters:
- subagent_type: "trellis-default-issue-writer"
- description: "Review created issue [ISSUE_ID]"
- run_in_background: true
- prompt: |
    Invoke the `issue-creation-review` skill to verify this issue.

    **Original User Requirements** (verbatim):
    ```
    [EXACT_ORIGINAL_INPUT_FROM_STEP_1]
    ```

    **Created Issue**: [ISSUE_ID]

    **Context from Creation**:
    [Any decisions made, clarifications received, or notable choices during creation]

    Verify the issue accurately reflects the original requirements.
    Check for completeness, correctness, and appropriate scope.
    If you have questions that need user answers, return them clearly.
```

Use `TaskOutput` to wait for the review to complete.

### 4. Handle Review Results

Process the review output based on its content:

#### Review Passes (No Issues Found)

If the review returns "APPROVED" with no findings:

- Report success to the user
- Proceed to output summary

#### Review Has Questions

If the review returns with "Clarification Needed" or questions:

1. Extract the questions from the review output
2. Use `AskUserQuestion` to get answers from the user
3. Re-run the review with the answers included:

```
Task tool parameters:
- subagent_type: "trellis-default-issue-writer"
- description: "Re-review issue [ISSUE_ID] with clarifications"
- run_in_background: true
- prompt: |
    Invoke the `issue-creation-review` skill to verify this issue.

    **Original User Requirements** (verbatim):
    ```
    [EXACT_ORIGINAL_INPUT]
    ```

    **Created Issue**: [ISSUE_ID]

    **Previous Review Questions and Answers**:
    Q1: [Question from reviewer]
    A1: [User's answer]

    Q2: [Question from reviewer]
    A2: [User's answer]

    Continue the review with these clarifications.
```

#### Review Finds Issues

If the review returns with ANY findings (major or minor):

**CRITICAL**: You MUST address ALL findings, not just "critical" ones. Every piece of feedback matters.

1. **Evaluate each finding**:
   - Is this finding valid and applicable?
   - If you believe a finding is incorrect, document your reasoning

2. **Fix all valid findings**:
   - Use `update_issue` to make corrections for EVERY valid finding
   - This includes minor issues like documentation, wording, or clarity improvements
   - Do not skip findings because they seem small

3. **Challenge incorrect findings** (if any):
   - If you genuinely believe a finding is wrong, explain why in your response
   - You are not required to blindly follow incorrect recommendations
   - But you MUST justify why you're not addressing a specific finding

4. **Re-run review** after making fixes to verify all findings were addressed

5. **Escalate only when blocked**:
   - Use `AskUserQuestion` only if you cannot resolve a finding yourself
   - Or if fixing a finding would contradict the original requirements

**Do NOT categorize findings as "minor" and ignore them.** The review exists to improve quality - every finding deserves attention.

## Output Format

Provide a summary of the creation and review process:

```
## Issue Creation Complete

### Created Issues
- [ISSUE_ID]: [Title] ([Type])
- [ISSUE_ID]: [Title] ([Type])

### Review Results
**Status**: Passed / Passed with Findings / Required Fixes

[Summary of review outcome]

### Actions Taken
[List any fixes made based on review feedback, or note if issues were accepted as-is]

### Next Steps
[Suggestions for what the user might want to do next - implement, add more detail, etc.]
```

## STOP After Completion

**After creating and reviewing the immediate child issues, STOP.**

- Report the created issues to the user
- Wait for further instructions
- Do NOT continue to decompose further (e.g., don't create Features after creating Epics)

The user will invoke this skill again on specific children if they want further decomposition.

## Key Requirement

**The original user instructions must be preserved verbatim and passed to the review agent.** This is critical for accurate verification. The orchestrator must not paraphrase or summarize in a way that could mislead the reviewer about what was actually requested.

## Guidelines

- **Verbatim preservation**: Never modify the original requirements when passing to review
- **Transparent process**: Keep the user informed of what's happening at each step
- **Address all findings**: Fix every valid review finding, including minor ones
- **Challenge thoughtfully**: If a finding seems wrong, explain why rather than silently ignoring it
- **Single review cycle**: Aim to resolve issues in one re-review; if still failing, escalate to user

<rules>
  <critical>Create ONLY immediate children (one level down) - do not recursively decompose</critical>
  <critical>STOP after creating and reviewing the immediate child level</critical>
  <critical>Preserve the original user instructions VERBATIM when passing to the review agent</critical>
  <critical>If a subagent fails or returns an error, STOP and report to the user</critical>
  <critical>Do not paraphrase or summarize requirements - the reviewer needs the exact original text</critical>
  <critical>Address ALL review findings - do not ignore feedback because it seems minor</critical>
  <critical>If you skip a finding, you MUST explain why you believe it is incorrect</critical>
  <important>Proceed autonomously when given a parent issue ID - do not ask for confirmation</important>
  <important>Default to coarser-grained issues at the current level (not deeper decomposition)</important>
</rules>
