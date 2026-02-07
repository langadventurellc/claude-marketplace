---
id: T-update-issue-implementation
title: Update issue-implementation skill and orchestration for new agent types
status: done
priority: high
parent: F-default-trellis-subagent-types
prerequisites:
  - T-create-three-default-agent
affectedFiles:
  plugins/task-trellis/skills/issue-implementation/SKILL.md: Removed coding
    guideline sections (Quality Standards, Testing ref, Documentation ref,
    Security & Performance Principles, Forbidden Patterns, Critical Error and
    Failure Handling rules block). Removed testing-guidelines.md reference from
    implementation phase. Preserved all workflow steps, Key Constraints, Do NOT
    Commit, and full allowed-tools frontmatter.
  plugins/task-trellis/skills/issue-implementation-orchestration/SKILL.md:
    Replaced all subagent_type 'general-purpose' with trellis-default-developer
    (task impl), trellis-default-reviewer (review, planning),
    trellis-default-author (docs). Updated Subagent Spawn Protocol with Agent
    Types table, Skill Specification section, Resumed Agents section, and
    configurability docs. Updated spawn prompts to use 'Invoke the
    task-trellis:X skill' pattern. Removed subagent_type from resume templates.
  plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md:
    Added Skill to allowed-tools. Consolidated duplicate Subagent Spawn Protocol
    sections into single clean section with Agent Types table, Skill
    Specification, Verify Skill Invocation (peek/kill), and configurability
    docs.
log:
  - >-
    Research phase complete. Read all files that need modification:

    1. issue-implementation/SKILL.md - Need to remove coding guideline sections
    (Security, Forbidden Patterns, Quality Standards, Testing, Documentation,
    Error/Failure Handling)

    2. issue-implementation-orchestration/SKILL.md - Need to replace
    "general-purpose" with appropriate agent types, update spawn protocol,
    update resume instructions

    3. issue-creation-orchestration/SKILL.md - Need to replace "general-purpose"
    with appropriate agent types, add Subagent Spawn Protocol, add Skill and
    TaskStop to allowed-tools


    Also verified the three agent files exist from the prerequisite task
    (T-create-three-default-agent).


    Key observations:

    - issue-creation-orchestration is missing Skill and TaskStop from
    allowed-tools (needed for spawn protocol)

    - issue-implementation-orchestration already has Skill, TaskOutput, TaskStop

    - All spawn prompts currently use subagent_type: "general-purpose"
  - >-
    Updated the issue-implementation skill and both orchestration skills
    (issue-implementation-orchestration and issue-creation-orchestration) to
    work with the new default agent types.


    Changes made:

    1. issue-implementation/SKILL.md: Removed coding guideline sections (Quality
    Standards, Testing, Documentation, Security & Performance Principles,
    Forbidden Patterns, Critical Error and Failure Handling) that are now in the
    trellis-default-developer agent. Kept all workflow steps (1-7), Key
    Constraints, Do NOT Commit section, and allowed-tools frontmatter unchanged.


    2. issue-implementation-orchestration/SKILL.md: Replaced all subagent_type
    "general-purpose" with appropriate types (trellis-default-developer for task
    implementation, trellis-default-reviewer for review and planning,
    trellis-default-author for documentation). Updated Subagent Spawn Protocol
    with Agent Types table, Skill Specification section (agents handle HOW,
    spawn prompts specify WHICH skill), Resumed Agents section (no skill
    re-invocation needed), and agent type configurability documentation. Updated
    all spawn prompt templates to use "Invoke the task-trellis:X skill" pattern
    instead of the old preamble. Removed subagent_type from resume templates
    since resumed agents inherit their type.


    3. issue-creation-orchestration/SKILL.md: Added Skill tool to allowed-tools.
    Cleaned up duplicate Subagent Spawn Protocol sections (from prerequisite
    task) into a single section with Agent Types table, Skill Specification,
    Verify Skill Invocation (peek/kill mechanism), and agent type
    configurability documentation. All spawn templates already used correct
    agent types and skill invocation patterns from prerequisite task.
schema: v1.0
childrenIds: []
created: 2026-02-07T20:23:40.952Z
updated: 2026-02-07T20:23:40.952Z
---

Update the `issue-implementation` skill and `issue-implementation-orchestration` skill to work with the new default agent types.

### `issue-implementation` skill changes (`skills/issue-implementation/SKILL.md`):
- **Remove** these sections (now in the developer agent):
  - Security & Performance Principles section
  - Forbidden Patterns section
  - Quality Standards section
  - Testing section (reference to `testing-guidelines.md`)
  - Documentation section (reference to `code-documentation-guidelines.md`)
  - Critical Error and Failure Handling section (the `<rules>` block and surrounding content about stopping on errors)
- **Keep** these sections:
  - All workflow steps (1-6)
  - "Do NOT Commit" section
  - Key Constraints section
  - `allowed-tools` frontmatter (unchanged — no tools removed)

### `issue-implementation-orchestration` skill changes:
- Replace all `subagent_type: "general-purpose"` with appropriate agent types:
  - Task implementation spawns → `subagent_type: "trellis-default-developer"`
  - Review spawns → `subagent_type: "trellis-default-reviewer"`
  - Planner spawns → `subagent_type: "trellis-default-reviewer"`
  - Docs-updater spawns → `subagent_type: "trellis-default-author"`
- **Update** the Subagent Spawn Protocol (do NOT remove it):
  - Preserve verification/peek/kill mechanism
  - Spawn prompts specify WHICH skill to invoke (not HOW — agent handles that)
  - Verification still checks for Skill tool invocation in early output
- Update spawn prompt templates to rely on agent's built-in instructions for HOW
- Update resume instructions: resumed agents already have behavioral guardrails, no skill re-invocation needed
- Add documentation about agent type configurability (users can override defaults)

### Key Constraints
- Skills retain ALL existing `allowed-tools` — no tools removed from any skill's frontmatter
- Subagent Spawn Protocol is UPDATED, not removed
- All spawn prompt templates must specify which skill the agent must invoke