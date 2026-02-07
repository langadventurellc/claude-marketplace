---
id: T-update-issue-implementation
title: Update issue-implementation-orchestration to use default Trellis agent types
status: open
priority: medium
parent: F-default-trellis-subagent-types
prerequisites:
  - T-create-default-trellis
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-07T19:06:30.951Z
updated: 2026-02-07T19:06:30.951Z
---

## Overview

Update `plugins/task-trellis/skills/issue-implementation-orchestration/SKILL.md` to use the new default Trellis agent types instead of `general-purpose`, remove the Subagent Spawn Protocol section entirely, and simplify all spawn prompt templates.

## Context

The `issue-implementation-orchestration` skill is the most complex orchestration skill. It currently:
- Has a full "Subagent Spawn Protocol" section (lines ~45-83) with skill invocation preamble, verification via TaskOutput peeking, kill-and-replace for non-compliant agents, and retry limits
- Spawns 4 types of subagents, all using `subagent_type: "general-purpose"`:
  1. **Implementation planner** — Section 4 (spawns `issue-implementation-planner`)
  2. **Task implementation** — Section 6.2 (spawns `issue-implementation`)
  3. **Task review** — Section 6.4 (spawns `issue-implementation-review`)
  4. **Documentation updater** — Section 8 (spawns `docs-updater`)
- Has resume spawn points in Sections 6.4 and 7 that also reference `subagent_type: "general-purpose"`

With the new agent types:
- The developer agent preloads `issue-implementation` via its `skills` frontmatter, so no skill invocation is needed
- The reviewer and author agents receive their skill context via the orchestrator's prompt, but don't need the elaborate preamble/verification protocol

## Changes Required

### 1. Remove the Subagent Spawn Protocol section entirely (lines ~45-83)

Delete the entire section including:
- "## Subagent Spawn Protocol" heading
- "### Skill Invocation Preamble" subsection
- "### Verify Skill Invocation" subsection
- The `<rules>` block about prepending preamble, peeking output, killing non-compliant agents
- The note at the start of the Process section that references the protocol ("All subagent spawns in this process must follow the Subagent Spawn Protocol above...")

### 2. Replace `subagent_type: "general-purpose"` in all spawn points

Map each spawn to its correct agent type:

| Spawn Point | Section | New Agent Type |
|------------|---------|----------------|
| Implementation planner | 4 | `trellis-default-reviewer` |
| Task implementation | 6.2 | `trellis-default-developer` |
| Recursive orchestration | 6.2 | `general-purpose` (recursive, needs full orchestration capability) |
| Task review | 6.4 | `trellis-default-reviewer` |
| Resume (feedback) | 6.4 | Remove `subagent_type` entirely (resume inherits from original) |
| Resume (error) | 7 | Remove `subagent_type` entirely (resume inherits from original) |
| Documentation updater | 8 | `trellis-default-author` |
| Resume (commit failure) | 9 | Remove `subagent_type` entirely (resume inherits from original) |

**Important**: For **resume** spawns (those using the `resume` parameter), remove the `subagent_type` field entirely. When resuming an agent, it already has its agent type from the original spawn. The Task tool's resume parameter handles this.

**Important**: For **recursive orchestration** spawns (spawning `issue-implementation-orchestration` on child features/epics), keep `subagent_type: "general-purpose"` because the recursive orchestrator needs full tool access including the Skill tool.

### 3. Simplify ALL spawn prompt templates

For each spawn point, remove:
- "Use the /issue-implementation skill to implement task..." or similar skill invocation lines
- "Use the /issue-implementation-review skill to review..." lines
- "Use the /docs-updater skill to review and update documentation..." lines
- "Use the /issue-implementation-planner skill to create an implementation plan..." lines
- Any references to the Skill tool

The developer agent already has `issue-implementation` preloaded via its `skills` frontmatter. The reviewer and author agents receive behavioral context from their agent type definition. The prompt should focus on the task-specific context only.

For **resume** prompts, also remove `subagent_type` from the Task tool parameters shown in code blocks.

### 4. Add Subagent Types documentation section

Add a new section (after the "## Issue Hierarchy" section, before the Process section) documenting the agent types:

```markdown
## Subagent Types

This skill uses the following default agent types for spawning subagents:

| Role | Default Agent Type | Purpose |
|------|-------------------|---------|
| Task Implementation | `trellis-default-developer` | Code implementation with preloaded issue-implementation skill |
| Code Review / Planning | `trellis-default-reviewer` | Read-only analysis for reviews and implementation planning |
| Documentation Updates | `trellis-default-author` | Updating docs after implementation |
| Recursive Orchestration | `general-purpose` | Orchestrating child issues (needs full tool access) |

These defaults can be overridden by the user providing a custom agent type. To use a custom agent type, create your own agent definition in your project's `agents/` directory and update the spawn instructions in this skill.
```

### 5. Update the Goal section

Update the Goal section to remove references to skill invocation:
- Step 1 should say "Spawning task implementations via the `trellis-default-developer` agent type" instead of "via the `issue-implementation` skill"
- Step 2 should say "Reviewing completed work via the `trellis-default-reviewer` agent type" instead of "via the `issue-implementation-review` skill"

### 6. Do NOT modify the `allowed-tools` frontmatter

The skill's existing `allowed-tools` list must remain unchanged.

## Files to Modify

- `plugins/task-trellis/skills/issue-implementation-orchestration/SKILL.md`

## Acceptance Criteria

1. The "Subagent Spawn Protocol" section is completely removed (heading, subsections, rules block, and all references to it)
2. No occurrences of `subagent_type: "general-purpose"` remain EXCEPT for recursive orchestration spawns
3. Task implementation spawns use `subagent_type: "trellis-default-developer"`
4. Review and planner spawns use `subagent_type: "trellis-default-reviewer"`
5. Documentation updater spawns use `subagent_type: "trellis-default-author"`
6. Resume spawn points do NOT include a `subagent_type` field
7. All spawn prompt templates are simplified — no skill invocation instructions, no Skill tool references
8. A Subagent Types section documents the defaults and how to override them
9. The `allowed-tools` frontmatter is identical to the current version
10. All existing orchestration logic (parallel execution, review cycles, error handling, commit workflow) is preserved

## Out of Scope

- Modifying `issue-creation-orchestration` (handled by a separate task)
- Creating the agent definition files (handled by prerequisite task T-create-default-trellis)
- Changing the skill's `allowed-tools` frontmatter
- Modifying any other skills (issue-implementation, issue-implementation-review, etc.)