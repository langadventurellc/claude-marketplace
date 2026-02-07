---
id: F-default-trellis-subagent-types
title: Default Trellis Subagent Types
status: done
priority: high
parent: none
prerequisites: []
affectedFiles:
  plugins/task-trellis/agents/trellis-default-developer.md: "Created developer
    agent definition with full YAML frontmatter (name, description, tools
    including Skill, Task, Read, Edit, Write, Bash, Glob, Grep, AskUserQuestion,
    Trellis MCP tools, Perplexity) and system prompt containing: Skill
    Invocation Mandate, Error Abort Mandate, Security & Performance Principles,
    Forbidden Patterns, Quality Standards, full inlined Testing Guidelines, full
    inlined Code Documentation Guidelines, and Error and Failure Handling
    rules."
  plugins/task-trellis/agents/trellis-default-reviewer.md: "Created reviewer agent
    definition with YAML frontmatter (name, description, tools including Skill,
    Read, Glob, Grep, Trellis MCP read tools, Perplexity) and system prompt
    containing: Skill Invocation Mandate, Error Abort Mandate, Evidence-Based
    Analysis, Actionable Output, Concise Structured Reporting, and Read-Only
    Constraint guidelines."
  plugins/task-trellis/agents/trellis-default-author.md: "Created author agent
    definition with YAML frontmatter (name, description, tools including Skill,
    Task, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Trellis MCP
    write tools, Perplexity) and system prompt containing: Skill Invocation
    Mandate, Error Abort Mandate, Research-First Approach, Codebase as Source of
    Truth, and Concise Writing guidelines."
  plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md:
    Added TaskStop to allowed-tools; added Agent Types section with
    configurability documentation; added full Subagent Spawn Protocol section
    (preamble, verification, kill, retry limit); added process note about
    applying protocol to all spawns; converted Step 3 from direct skill
    invocation to trellis-default-author subagent spawn; replaced
    general-purpose with trellis-default-reviewer in review spawns (Steps 4 and
    5); updated all spawn prompts to specify fully-qualified skill names.; Added
    Skill to allowed-tools. Consolidated duplicate Subagent Spawn Protocol
    sections into single clean section with Agent Types table, Skill
    Specification, Verify Skill Invocation (peek/kill), and configurability
    docs.
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
log:
  - "Auto-completed: All child tasks are complete"
schema: v1.0
childrenIds:
  - T-create-three-default-agent
  - T-update-issue-creation
  - T-update-issue-implementation
created: 2026-02-07T18:30:35.096Z
updated: 2026-02-07T18:30:35.096Z
---

## Overview

Create three default subagent type definitions for the Task Trellis plugin and update the orchestration skills to use them. These subagent types replace the current pattern of spawning `general-purpose` subagents, solving two key problems:

1. **Permission persistence on resume**: When an orchestrator resumes a subagent to address review feedback, the agent retains its subagent type's tool permissions and behavioral guardrails — no skill re-invocation needed.
2. **Configurable coding guidelines**: Because the plugin is language/framework-agnostic, coding guidelines couldn't live in skills. Moving behavioral guardrails (security principles, testing guidelines, documentation guidelines, error handling, etc.) to default subagent types means users can swap in their own customized agent types (e.g., a `my-project-developer` with project-specific coding standards) while keeping the orchestration skills unchanged.

### Design Principle: Agents and Skills are Orthogonal

Agents and skills are **fully decoupled**. Agents define HOW to code (standards, guidelines, behavioral guardrails). Skills define WHAT workflow to follow (Trellis-specific steps, structured output, process). Neither preloads the other.

- **Agents do NOT preload skills** via the `skills` frontmatter field. This keeps agents reusable across different skills.
- **The orchestrator tells each agent which skill to invoke** at spawn time via the prompt. The agent's own system prompt contains generic instructions to invoke whatever skill it's assigned.
- **All agents include the `Skill` tool** so they can invoke their assigned skill at runtime.
- **Coding guidelines live in agents**, not skills. When users swap in a custom agent type, they bring their own project-specific guidelines.

## Subagent Types to Create

All three agents are defined as Markdown files in `plugins/task-trellis/agents/`. Names are prefixed with `trellis-default-` to clearly identify them as default implementations that can be swapped out.

### Common Agent Prompt Requirements

Every agent's system prompt (the markdown body) MUST include these instructions:

**Skill Invocation Mandate** (adapt wording to agent role):
```
MANDATORY FIRST ACTION: Your very first action MUST be to use the Skill tool to invoke
the skill specified in your task prompt. Do NOT read files, do NOT search code, do NOT
analyze anything, do NOT take ANY other action before invoking this skill. The skill
contains your complete workflow and instructions.
```

**Error Abort Mandate**:
```
If you encounter ANY errors invoking the skill (permission denied, skill not found, tool
not available, or any other error), STOP IMMEDIATELY and report the exact error back. Do
NOT attempt workarounds. Do NOT try to perform the task without the skill.
```

These instructions exist in the agent prompt so that regardless of how the agent is spawned (orchestrated or standalone), it always prioritizes skill invocation and fails safely.

### 1. `trellis-default-developer`
- **Purpose**: Code implementation — writing, testing, debugging code changes
- **Used by**: `issue-implementation-orchestration` for task implementation and resumed agents addressing feedback
- **Tools**: Skill, Task, Read, Edit, Write, Bash, Glob, Grep, AskUserQuestion, plus Trellis MCP tools (claim_task, get_issue, get_next_available_issue, complete_task, append_issue_log, append_modified_files, update_issue, list_issues), Perplexity
- **System prompt content** (moved from `issue-implementation` skill):
  - Skill Invocation Mandate + Error Abort Mandate (see above)
  - Security & performance principles (validate inputs, secure defaults, parameterized queries, etc.)
  - Forbidden patterns (no `any` types, no sleep/wait loops, no hardcoded secrets, etc.)
  - Quality standards (research first, purposeful testing, quality checks)
  - Testing guidelines (consolidated from `testing-guidelines.md` — the full content, not a reference)
  - Code documentation guidelines (consolidated from `code-documentation-guidelines.md` — the full content, not a reference)
  - Error and failure handling rules (stop on errors, never work around failures, report to user)
- **What stays in the skill** (`issue-implementation`): The specific Trellis workflow steps (claim, research, plan, implement, complete), structured output format, Trellis-specific process, "do not commit" constraint (workflow-dependent, not a universal coding standard)

### 2. `trellis-default-reviewer`
- **Purpose**: Read-only analysis of code, issues, and plans
- **Used by**: `issue-implementation-orchestration` for code review (`issue-implementation-review`), issue verification (`issue-creation-review` via `issue-creation-orchestration`), and implementation planning (`issue-implementation-planner`)
- **Tools**: Skill, Read, Glob, Grep, plus Trellis MCP read tools (get_issue, list_issues), Perplexity
- **System prompt content**:
  - Skill Invocation Mandate + Error Abort Mandate (see above)
  - Evidence-based analysis — support findings with specific file references
  - Actionable output — recommendations should be specific and implementable
  - Concise structured reporting — skip positive assessments, only report items requiring action
  - No implementation/modification of files — this agent is read-only

### 3. `trellis-default-author`
- **Purpose**: Creating/updating Trellis issues and documentation
- **Used by**: `issue-creation-orchestration` for issue creation (`issue-creation`) and `issue-implementation-orchestration` for documentation updates (`docs-updater`)
- **Tools**: Skill, Task, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, plus Trellis MCP write tools (create_issue, get_issue, update_issue, list_issues), Perplexity
- **System prompt content**:
  - Skill Invocation Mandate + Error Abort Mandate (see above)
  - Research-first approach — search the codebase before creating anything
  - Codebase-as-source-of-truth — parent issues may be outdated, verify against reality
  - Concise writing — no over-engineering, KISS/YAGNI principles

## Orchestration Skill Updates

Both orchestration skills need updates to:

1. **Replace `subagent_type: "general-purpose"` with the appropriate default Trellis agent type** in all subagent spawn instructions
2. **Update the Subagent Spawn Protocol** — adapt it for the new agent types while preserving the verification/peek/kill mechanism. Agents now have generic "invoke skill first" instructions in their own prompts, but the orchestrator's spawn prompts must still specify WHICH skill to invoke, and the orchestrator must still verify compliance.
3. **Add documentation about agent type configurability** — explain that the default agent types can be overridden by the user specifying a different agent type, and how to do so
4. **Update resume instructions** — resumed agents already have their behavioral guardrails from the agent type; they do not need skill re-invocation on resume

### Subagent Spawn Protocol (Updated, NOT Removed)

The existing Subagent Spawn Protocol in `issue-implementation-orchestration` MUST be preserved and updated. Subagents have a strong, observed tendency to ignore skill invocation instructions and attempt tasks ad-hoc, producing inconsistent results. The protocol is the last line of defense.

**What stays the same:**
- Launch all new subagents with `run_in_background: true`
- Peek at early output via `TaskOutput` with `block: false` to verify the Skill tool is invoked
- Kill non-compliant agents with `TaskStop` and spawn replacements
- Retry limit: if two consecutive agents fail to invoke their skill, STOP and escalate to user

**What changes:**
- The preamble in spawn prompts no longer needs to explain HOW to invoke a skill (the agent's own system prompt already handles that) — but it MUST still specify WHICH skill to invoke (e.g., "Invoke the `task-trellis:issue-implementation` skill")
- The verification step checks for Skill tool invocation in early output (same as before)

### `issue-implementation-orchestration` changes:
- Task implementation spawns: `subagent_type: "trellis-default-developer"`
- Review spawns: `subagent_type: "trellis-default-reviewer"`
- Planner spawns: `subagent_type: "trellis-default-reviewer"`
- Docs-updater spawns: `subagent_type: "trellis-default-author"`
- Resume spawns: Use the same agent type as the original spawn (already handled by Task tool resume)
- Update Section "Subagent Spawn Protocol" — adapt for new agent types, preserve verification
- Update spawn prompt templates: specify which skill to invoke, rely on agent's built-in instructions for HOW

### `issue-creation-orchestration` changes:
- Issue creation spawns: `subagent_type: "trellis-default-author"`
- Review spawns: `subagent_type: "trellis-default-reviewer"`
- Add the same Subagent Spawn Protocol (verification/peek/kill) that `issue-implementation-orchestration` uses — `issue-creation-orchestration` currently lacks this safeguard

## Skill Updates

### `issue-implementation` skill changes:
- **Remove** from the skill: Security & Performance Principles section, Forbidden Patterns section, Quality Standards section, Testing section (reference to `testing-guidelines.md`), Documentation section (reference to `code-documentation-guidelines.md`), Critical Error and Failure Handling section (the `<rules>` block and surrounding content about stopping on errors)
- **Keep** in the skill: All workflow steps (1-6), "Do NOT Commit" section, Key Constraints section, the `allowed-tools` frontmatter (unchanged)
- **Rationale**: Coding guidelines now live in the agent. The skill retains only the Trellis-specific workflow. When users swap in a custom agent type, they bring their own guidelines; the workflow stays the same.

### Other skills: No changes
- `issue-implementation-review`, `issue-creation-review`, `issue-implementation-planner`, `docs-updater`, `issue-creation` — these skills are invoked by the reviewer and author agents at runtime and do not need modification.

## Acceptance Criteria

1. Three agent definition files exist in `plugins/task-trellis/agents/`:
   - `trellis-default-developer.md`
   - `trellis-default-reviewer.md`
   - `trellis-default-author.md`
2. Each agent has appropriate YAML frontmatter: `name`, `description`, and `tools` (no `skills` frontmatter — agents and skills are orthogonal)
3. All three agents include the `Skill` tool in their `tools` list
4. All three agents include the Skill Invocation Mandate and Error Abort Mandate in their system prompts
5. The `trellis-default-developer` agent's system prompt includes all coding guidelines moved from the skill: security principles, forbidden patterns, quality standards, testing guidelines (full content from `testing-guidelines.md`), code documentation guidelines (full content from `code-documentation-guidelines.md`), and error handling rules
6. The `issue-implementation` skill is updated: coding guidelines sections are removed, workflow steps and "do not commit" constraint are preserved, `allowed-tools` frontmatter is unchanged
7. Both orchestration skills (`issue-implementation-orchestration`, `issue-creation-orchestration`) use the new agent types instead of `general-purpose`
8. The Subagent Spawn Protocol in `issue-implementation-orchestration` is **updated** (not removed) — verification/peek/kill mechanism is preserved and adapted for the new agent types
9. The `issue-creation-orchestration` skill gains the same Subagent Spawn Protocol (verification/peek/kill) that `issue-implementation-orchestration` uses
10. All spawn prompt templates specify which skill the agent must invoke
11. Skills retain ALL of their existing `allowed-tools` — no tools are removed from any skill's frontmatter
12. Orchestration skills document that the default agent types can be overridden by the user

## Implementation Guidance

- Agent files follow the standard Claude Code agent Markdown format with YAML frontmatter
- **Do NOT use the `skills` frontmatter field** — agents and skills are orthogonal. Skills are invoked at runtime via the Skill tool.
- The `tools` field in agent frontmatter uses the tool names as they appear in Claude Code (e.g., `Read`, `Edit`, `Skill`, `mcp__task-trellis__get_issue`)
- Do not specify `model` — agents inherit from the parent conversation
- Do not specify `permissionMode` — agents inherit from the parent conversation (same as general-purpose behavior)
- Names use `trellis-default-` prefix to signal they are default implementations meant to be swappable
- The `testing-guidelines.md` and `code-documentation-guidelines.md` files should be consolidated (full content inlined) into the developer agent's system prompt, not referenced as separate files

## Testing Requirements

- Verify agent files are valid Markdown with proper YAML frontmatter
- Verify all three agents include the `Skill` tool in their tools list
- Verify all three agents include the Skill Invocation Mandate and Error Abort Mandate in their system prompts
- Verify orchestration skills reference the correct agent type names
- Verify no tools were removed from any skill's `allowed-tools`
- Verify the Subagent Spawn Protocol is preserved (updated, not removed) in `issue-implementation-orchestration`
- Verify `issue-creation-orchestration` now has the Subagent Spawn Protocol
- Verify the `issue-implementation` skill no longer contains coding guidelines sections (security, forbidden patterns, testing, documentation, error handling)
- Verify the `issue-implementation` skill still contains workflow steps and "do not commit" constraint

## Dependencies

None — this is a standalone feature.
