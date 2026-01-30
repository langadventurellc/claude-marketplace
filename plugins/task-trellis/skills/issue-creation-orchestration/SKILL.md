---
name: issue-creation-orchestration
description: Orchestrates issue creation with automatic review. Use when asked to "create and review issues", "create verified issues", or when you want issues automatically validated against requirements.
allowed-tools:
  - mcp__task-trellis__create_issue
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__update_issue
  - mcp__task-trellis__list_issues
  - Task
  - TaskOutput
  - Glob
  - Grep
  - Read
  - AskUserQuestion
---

# Issue Creation with Review

Orchestrate issue creation with automatic review to ensure created issues accurately reflect the original requirements.

## Goal

Create Trellis issues using the `issue-creation` skill, then automatically verify them against the original requirements using `issue-creation-review`. Handle any questions or findings from the review before completing.

## Input

`$ARGUMENTS` - The user's original requirements/instructions for issue creation

## Process

### 1. Capture Original Input

**CRITICAL**: Store the exact user instructions verbatim at the start.

```
Original User Requirements:
---
[EXACT_USER_INPUT_HERE]
---
```

This exact text will be passed to the review agent. Do not paraphrase, summarize, or modify it in any way. The reviewer needs the original requirements to verify the created issues accurately.

### 2. Invoke Issue Creation

Use the `issue-creation` skill to create the requested issues:

1. Determine the appropriate issue type(s) from the user's request
2. Follow the issue-creation workflow for that type
3. Ask clarifying questions as needed using AskUserQuestion
4. Create the issue(s) using the Trellis MCP tools
5. Track all created issue IDs and their types

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
- subagent_type: "general-purpose"
- description: "Review created issue [ISSUE_ID]"
- run_in_background: true
- prompt: |
    Use the /issue-creation-review skill to verify this issue.

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

If the review returns "APPROVED" or has no critical findings:

- Report success to the user
- Proceed to output summary

#### Review Has Questions

If the review returns with "Clarification Needed" or questions:

1. Extract the questions from the review output
2. Use `AskUserQuestion` to get answers from the user
3. Re-run the review with the answers included:

```
Task tool parameters:
- subagent_type: "general-purpose"
- description: "Re-review issue [ISSUE_ID] with clarifications"
- run_in_background: true
- prompt: |
    Use the /issue-creation-review skill to verify this issue.

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

If the review returns "NEEDS REVISION" or critical findings:

1. Report the findings to the user clearly
2. Use `AskUserQuestion` to ask how to proceed:
   - **Fix issues**: Update the created issues based on findings
   - **Accept as-is**: Keep issues despite findings
   - **Delete and restart**: Remove issues and start over

3. Follow the user's direction:
   - If fixing: Use `update_issue` to make corrections, then re-run review
   - If accepting: Proceed to output summary with note about accepted findings
   - If restarting: Delete issues and return to Step 2

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

## Key Requirement

**The original user instructions must be preserved verbatim and passed to the review agent.** This is critical for accurate verification. The orchestrator must not paraphrase or summarize in a way that could mislead the reviewer about what was actually requested.

## Guidelines

- **Verbatim preservation**: Never modify the original requirements when passing to review
- **Transparent process**: Keep the user informed of what's happening at each step
- **User control**: Let the user decide how to handle review findings
- **Single review cycle**: Aim to resolve issues in one re-review; if still failing, escalate to user
