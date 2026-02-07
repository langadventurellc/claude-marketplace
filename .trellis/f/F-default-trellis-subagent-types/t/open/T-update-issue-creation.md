---
id: T-update-issue-creation
title: Update issue-creation-orchestration to use default Trellis agent types
status: open
priority: medium
parent: F-default-trellis-subagent-types
prerequisites:
  - T-create-default-trellis
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-07T19:06:00.076Z
updated: 2026-02-07T19:06:00.076Z
---

## Overview

Update `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md` to use the new default Trellis agent types instead of `general-purpose` in all subagent spawn instructions.

## Context

The `issue-creation-orchestration` skill currently spawns two types of subagents, both using `subagent_type: "general-purpose"`:
1. **Issue creation agents** — spawn the `issue-creation` skill (Section 3)
2. **Review agents** — spawn the `issue-creation-review` skill (Sections 4 and 5)

Both spawn points include a Skill invocation preamble pattern (telling the subagent to use `/issue-creation-review` or similar). With the new agent types, the orchestrator still passes the skill name in the prompt (since the reviewer/author agents don't preload skills), but the elaborate preamble and verification protocol are no longer needed.

## Changes Required

### 1. Replace `subagent_type: "general-purpose"` in all spawn points

There are currently 3 spawn points in the file (Sections 4 and 5):

- **Section 4 (Review spawn)**: Change `subagent_type: "general-purpose"` → `subagent_type: "trellis-default-reviewer"`
- **Section 5 - Re-review spawn**: Change `subagent_type: "general-purpose"` → `subagent_type: "trellis-default-reviewer"`

Note: Section 3 ("Invoke Issue Creation") currently does NOT use the Task tool to spawn — it uses the Skill tool directly in the same agent context. Verify whether this needs to change. If it already creates issues in the orchestrator's own context, it stays as-is. If it spawns a subagent, change it to `subagent_type: "trellis-default-author"`.

### 2. Simplify spawn prompt templates

Remove skill invocation preamble instructions from spawn prompts. The reviewer agent already knows it's a reviewer from its agent type definition. The prompt should just describe the task:
- Remove "Use the /issue-creation-review skill to verify this issue." or similar preamble lines
- Keep the task-specific content (original requirements, issue ID, context)

### 3. Add Subagent Types documentation section

Add a new section (after the Process section, before the Output Format section) documenting the agent types used:

```markdown
## Subagent Types

This skill uses the following default agent types:

| Role | Default Agent Type | Purpose |
|------|-------------------|---------|
| Issue Review | `trellis-default-reviewer` | Read-only verification of created issues |

These defaults can be overridden by the user providing a custom agent type. To use a custom agent type, create your own agent definition in your project's `agents/` directory and update the spawn instructions in this skill.
```

### 4. Do NOT modify the `allowed-tools` frontmatter

The skill's existing `allowed-tools` list must remain unchanged. The agent type's tools are separate from the skill's tools.

## Files to Modify

- `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md`

## Acceptance Criteria

1. No occurrences of `subagent_type: "general-purpose"` remain in the file
2. Review spawn points use `subagent_type: "trellis-default-reviewer"`
3. Spawn prompt templates are simplified (no skill invocation preamble or verification instructions)
4. A Subagent Types section documents the default agent types and how to override them
5. The `allowed-tools` frontmatter is unchanged from the current version
6. All existing functionality is preserved — only the subagent type and prompt templates change

## Out of Scope

- Modifying `issue-implementation-orchestration` (handled by a separate task)
- Creating the agent definition files (handled by prerequisite task T-create-default-trellis)
- Changing the skill's `allowed-tools` frontmatter