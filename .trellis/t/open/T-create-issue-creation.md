---
id: T-create-issue-creation
title: Create issue-creation-orchestration skill for automated review workflow
status: open
priority: medium
parent: none
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T00:59:33.800Z
updated: 2026-01-30T00:59:33.800Z
---

# Create issue-creation-orchestration Skill

Create a wrapper skill that orchestrates issue creation with automatic review. Ensures created issues are verified against original requirements before completion.

## Reference

Full requirements: `docs/orchestration-enhancements-requirements.md` (Change 3)

## File to Create

`plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md`

## Skill Properties (Frontmatter)

```yaml
---
name: issue-creation-orchestration
description: Orchestrates issue creation with automatic review. Use when asked to "create and review issues", "create verified issues", or when you want issues automatically validated against requirements.
allowed-tools:
  - mcp__task-trellis__create_issue
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__update_issue
  - mcp__task-trellis__list_issues
  - Task
  - Glob
  - Grep
  - Read
  - AskUserQuestion
---
```

Note: This skill runs in the main conversation (no `context: fork`) because it needs to interact with the user for clarifications.

## Skill Behavior

### Input

`$ARGUMENTS` - The user's original requirements/instructions for issue creation

### Process

1. **Capture original input verbatim**:
   - Store the exact user instructions at the start
   - This is critical—do not paraphrase or summarize
   - The original input will be passed to the review agent

2. **Invoke issue creation**:
   - Use the `issue-creation` skill per the user's instructions
   - Follow all normal issue creation workflows
   - Track which issues are created (IDs and types)

3. **Spawn review for each created issue**:
   - After issues are created, spawn `issue-creation-review` as async subagent using Task tool
   - Pass to the reviewer:
     - The exact original user input (verbatim)
     - The created issue ID(s)
     - Any context or decisions made during creation
   
   ```
   Task tool parameters:
   - subagent_type: "general-purpose"
   - description: "Review created issue [ISSUE_ID]"
   - run_in_background: true
   - prompt: |
       Use the /issue-creation-review skill to verify this issue.
       
       **Original User Requirements** (verbatim):
       ```
       [EXACT_ORIGINAL_INPUT]
       ```
       
       **Created Issue**: [ISSUE_ID]
       
       **Context from Creation**: [Any decisions or clarifications made]
       
       Verify the issue accurately reflects the original requirements.
       If you have questions that need user answers, return them clearly.
   ```

4. **Handle review results**:
   - Wait for review to complete using TaskOutput
   - **If review passes**: Report success to user
   - **If review has questions**: 
     - Surface questions to user using AskUserQuestion
     - Get answers
     - Re-run review with the answers included
   - **If review finds issues**:
     - Report findings to user
     - Let user decide how to address (fix issues, accept as-is, etc.)

### Output Format

```
## Issue Creation Complete

### Created Issues
- [ISSUE_ID]: [Title]
- [ISSUE_ID]: [Title]

### Review Results
[Summary of review outcome - passed, or issues found]

### Actions Taken
[Any fixes made based on review feedback]
```

## Key Requirement

**The original user instructions must be preserved verbatim and passed to the review agent.** The orchestrator must not paraphrase or summarize in a way that could mislead the reviewer about what was actually requested.

## Acceptance Criteria

- [ ] Skill file created at `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md`
- [ ] Proper frontmatter (no `context: fork` - runs in main conversation)
- [ ] Captures original user input verbatim at start
- [ ] Directs use of issue-creation skill for actual creation
- [ ] Spawns issue-creation-review as async subagent with original input
- [ ] Handles review questions by getting user answers and re-running
- [ ] Reports review findings to user

## Technical Notes

- Pattern after the orchestration.md file for subagent spawning
- The skill should reference using the issue-creation skill, not duplicate its logic
- Use Task tool with `run_in_background: true` for async review
- The review skill already handles the "return early with questions" pattern