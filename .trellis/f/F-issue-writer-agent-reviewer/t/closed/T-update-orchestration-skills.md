---
id: T-update-orchestration-skills
title: Update orchestration skills to use correct agent types
status: done
priority: medium
parent: F-issue-writer-agent-reviewer
prerequisites:
  - T-create-trellis-default-issue
affectedFiles:
  plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md:
    Updated Agent Types table to use trellis-default-issue-writer for both issue
    creation and review roles. Updated configurability text to reference
    issue-writer agent. Changed subagent_type from trellis-default-author to
    trellis-default-issue-writer in creation spawn (line 138). Changed
    subagent_type from trellis-default-reviewer to trellis-default-issue-writer
    in review spawn (line 178) and re-review spawn (line 222).
  plugins/task-trellis/skills/issue-implementation-orchestration/SKILL.md:
    Updated Agent Types table Planning row from trellis-default-reviewer to
    Explore (built-in) with updated purpose description. Added note in
    configurability documentation that planner uses the built-in Explore
    subagent type. Changed subagent_type from trellis-default-reviewer to
    Explore in planner spawn (line 149). All other agent type references
    (developer, reviewer, author) unchanged.
log:
  - Updated both orchestration skills to reference the correct agent types. In
    issue-creation-orchestration/SKILL.md, changed all three subagent spawns
    (creation, review, re-review) and the Agent Types table from
    trellis-default-author/trellis-default-reviewer to
    trellis-default-issue-writer. Updated configurability text to reference the
    issue-writer role. In issue-implementation-orchestration/SKILL.md, changed
    the planner spawn and Agent Types table from trellis-default-reviewer to the
    built-in Explore subagent type, and added a note in the configurability
    documentation explaining that Explore is a built-in Claude Code type for
    read-only codebase exploration. All other agent type references (developer,
    reviewer, author) in issue-implementation-orchestration remain unchanged. No
    allowed-tools or workflow logic was modified.
schema: v1.0
childrenIds: []
created: 2026-02-07T21:28:44.459Z
updated: 2026-02-07T21:28:44.459Z
---

## Overview

Update both orchestration skills to reference the correct agent types after the new `trellis-default-issue-writer` agent is created and the reviewer is specialized.

## Files to Modify

### 1. `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md`

#### Agent Types Table (lines 46-49)

Change from:
```
| Issue creation | `trellis-default-author` | Creating/updating Trellis issues |
| Review | `trellis-default-reviewer` | Read-only issue verification |
```

To:
```
| Issue creation | `trellis-default-issue-writer` | Creating/updating Trellis issues |
| Review | `trellis-default-issue-writer` | Issue verification |
```

#### Issue Creation Spawn (line 138)

Change `subagent_type` from `"trellis-default-author"` to `"trellis-default-issue-writer"`.

#### Review Spawn (lines 178, 222)

Change `subagent_type` from `"trellis-default-reviewer"` to `"trellis-default-issue-writer"` in both the initial review spawn and the re-review spawn.

#### Agent Type Configurability Documentation (line 51)

Update the configurability text to reference the new agent type names. The text currently mentions "a custom author agent with project-specific writing guidelines" — update to reflect the issue-writer role.

### 2. `plugins/task-trellis/skills/issue-implementation-orchestration/SKILL.md`

#### Agent Types Table (lines 47-52)

Change the Planning row from:
```
| Planning | `trellis-default-reviewer` | Read-only implementation planning |
```

To:
```
| Planning | `Explore` (built-in) | Read-only codebase exploration |
```

Keep the other rows unchanged:
- Task implementation: `trellis-default-developer` (unchanged)
- Review: `trellis-default-reviewer` (unchanged)
- Documentation: `trellis-default-author` (unchanged)

#### Planner Spawn (line 149)

Change `subagent_type` from `"trellis-default-reviewer"` to `"Explore"`.

#### Agent Type Configurability Documentation (line 54)

Update to note that the planner uses the built-in `Explore` subagent type (not a Trellis agent), since its role is purely read-only codebase exploration and any additional tools can be provided via the skill.

## Important Constraints

- Do NOT change any `allowed-tools` in any skill's frontmatter
- Do NOT change the orchestration workflow logic — only the agent type references
- The `Explore` type is a built-in Claude Code subagent type, not a file in the agents directory
- All other agent type references in `issue-implementation-orchestration` remain unchanged

## Acceptance Criteria

1. `issue-creation-orchestration` uses `trellis-default-issue-writer` for both creation and review spawns
2. `issue-creation-orchestration` Agent Types table shows `trellis-default-issue-writer` for both roles
3. `issue-implementation-orchestration` uses `Explore` for planner spawns
4. `issue-implementation-orchestration` Agent Types table shows `Explore` for planning
5. `issue-implementation-orchestration` configurability docs note `Explore` is built-in
6. Task implementation, review, and documentation agent types in `issue-implementation-orchestration` are UNCHANGED
7. No `allowed-tools` changed in any skill frontmatter
8. Orchestration workflow logic is unchanged — only agent type values differ

## Out of Scope

- Creating or modifying any agent files
- Removing guideline references from skills (handled by a separate task)
- Deleting any files