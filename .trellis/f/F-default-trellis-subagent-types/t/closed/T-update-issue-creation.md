---
id: T-update-issue-creation
title: Update issue-creation-orchestration for new agent types
status: done
priority: high
parent: F-default-trellis-subagent-types
prerequisites:
  - T-create-three-default-agent
affectedFiles:
  plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md:
    Added TaskStop to allowed-tools; added Agent Types section with
    configurability documentation; added full Subagent Spawn Protocol section
    (preamble, verification, kill, retry limit); added process note about
    applying protocol to all spawns; converted Step 3 from direct skill
    invocation to trellis-default-author subagent spawn; replaced
    general-purpose with trellis-default-reviewer in review spawns (Steps 4 and
    5); updated all spawn prompts to specify fully-qualified skill names.
log:
  - >-
    Research complete. Identified changes needed:

    1. Add TaskStop to allowed-tools frontmatter

    2. Replace 2 existing `general-purpose` subagent_type references with
    `trellis-default-reviewer`

    3. Convert Step 3 from direct skill invocation to subagent spawn with
    `trellis-default-author`

    4. Add Subagent Spawn Protocol section (matching
    issue-implementation-orchestration pattern)

    5. Update all spawn prompts to specify which skill to invoke

    6. Add agent type configurability documentation

    Beginning implementation.
  - 'Updated issue-creation-orchestration skill with new agent types and
    Subagent Spawn Protocol. Changes: (1) Added TaskStop to allowed-tools
    frontmatter for the kill mechanism. (2) Replaced all subagent_type:
    "general-purpose" with trellis-default-reviewer for review spawns. (3)
    Converted Step 3 from direct skill invocation to spawning a
    trellis-default-author subagent that invokes the issue-creation skill. (4)
    Added the full Subagent Spawn Protocol section with Skill Invocation
    Preamble, verification/peek/kill mechanism, and retry limits — matching the
    pattern from issue-implementation-orchestration. (5) Updated all spawn
    prompts to specify the fully-qualified skill name
    (task-trellis:issue-creation, task-trellis:issue-creation-review). (6) Added
    Agent Types section documenting the default agent types and how users can
    override them. (7) Added process-level note about applying the Subagent
    Spawn Protocol to all spawns. All existing allowed-tools were preserved —
    only TaskStop was added.'
schema: v1.0
childrenIds: []
created: 2026-02-07T20:23:45.629Z
updated: 2026-02-07T20:23:45.629Z
---

Update the `issue-creation-orchestration` skill to use the new default agent types and add the Subagent Spawn Protocol.

### Changes:
- Replace all `subagent_type: "general-purpose"` with appropriate agent types:
  - Issue creation spawns → `subagent_type: "trellis-default-author"`
  - Review spawns → `subagent_type: "trellis-default-reviewer"`
- **Add `TaskStop` to the skill's `allowed-tools` frontmatter** — the Subagent Spawn Protocol requires `TaskStop` for killing non-compliant agents, and `issue-creation-orchestration` currently lacks it. This is a new tool addition, not a removal (AC #11 is about not removing existing tools).
- **Add the Subagent Spawn Protocol** — this skill currently lacks it. Add the same verification/peek/kill mechanism from `issue-implementation-orchestration`:
  - Launch all new subagents with `run_in_background: true`
  - Peek at early output via `TaskOutput` with `block: false` to verify the Skill tool is invoked
  - Kill non-compliant agents with `TaskStop` and spawn replacements
  - Retry limit: if two consecutive agents fail to invoke their skill, STOP and escalate to user
- Update spawn prompt templates to specify WHICH skill the agent must invoke
- Add documentation about agent type configurability (users can override defaults)

### Key Constraints
- Spawn prompts must specify which skill to invoke
- Subagent Spawn Protocol must match the pattern in `issue-implementation-orchestration`
- Skills retain ALL existing `allowed-tools` — only add `TaskStop`, do not remove any existing tools