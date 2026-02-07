---
id: F-default-trellis-subagent-types
title: Default Trellis Subagent Types
status: open
priority: high
parent: none
prerequisites: []
affectedFiles:
  plugins/task-trellis/agents/trellis-default-developer.md: "Created developer
    agent definition with skills: [issue-implementation], full
    read/write/execute tools plus Trellis MCP tools and Perplexity, and system
    prompt containing consolidated testing guidelines, code documentation
    guidelines, security principles, forbidden patterns, quality standards,
    do-not-commit constraint, and error handling rules"
  plugins/task-trellis/agents/trellis-default-reviewer.md: Created reviewer agent
    definition with read-only tools (Read, Glob, Grep, Trellis
    get_issue/list_issues, Perplexity), no skills preloaded, and system prompt
    emphasizing read-only posture, evidence-based analysis, actionable concise
    output, structured findings format, and no-implementation boundaries
  plugins/task-trellis/agents/trellis-default-author.md: Created author agent
    definition with read + limited write tools plus Trellis
    create/get/update/list_issues and Perplexity, no skills preloaded, and
    system prompt emphasizing research-first approach,
    codebase-as-source-of-truth, concise writing, no over-engineering, and clear
    author-not-implementer boundaries
  plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md:
    Updated all three Task tool spawn points to use trellis-default-author (for
    creation) and trellis-default-reviewer (for review) instead of
    general-purpose. Removed all skill invocation instructions from spawn
    prompts. Added Subagent Types section documenting default agent types and
    configurability. Updated Goal section. Preserved all allowed-tools and
    verbatim requirements pass-through.
  plugins/task-trellis/skills/issue-implementation-orchestration/SKILL.md:
    "Removed Subagent Spawn Protocol section entirely (preamble, verification,
    kill-and-replace, rules block). Added Subagent Types section with agent type
    table and customization documentation. Replaced subagent_type:
    general-purpose with trellis-default-developer (task implementation),
    trellis-default-reviewer (review and planning), trellis-default-author (docs
    updater). Simplified all spawn prompt templates to remove skill invocation
    instructions. Removed subagent_type from all resume prompt templates."
log:
  - "Auto-completed: All child tasks are complete"
schema: v1.0
childrenIds: []
created: 2026-02-07T18:30:35.096Z
updated: 2026-02-07T18:30:35.096Z
---

## Overview

Create three default subagent type definitions for the Task Trellis plugin and update the orchestration skills to use them. These subagent types replace the current pattern of spawning `general-purpose` subagents that must invoke skills at runtime, solving two key problems:

1. **Permission persistence on resume**: When an orchestrator resumes a subagent to address review feedback, the agent retains its subagent type's tool permissions and behavioral guardrails — no skill re-invocation needed.
2. **Configurable coding guidelines**: Because the plugin is language/framework-agnostic, coding guidelines couldn't live in skills. Moving behavioral guardrails to default subagent types means users can swap in their own customized agent types (e.g., a `my-project-developer` with project-specific coding standards) while keeping the orchestration skills unchanged.

## Subagent Types to Create

All three agents are defined as Markdown files in `plugins/task-trellis/agents/`. Names are prefixed with `trellis-default-` to clearly identify them as default implementations that can be swapped out.

### 1. `trellis-default-developer`
- **Purpose**: Code implementation — writing, testing, debugging code changes
- **Used by**: `issue-implementation-orchestration` for task implementation and resumed agents addressing feedback
- **Skills**: `issue-implementation` (preloaded via `skills` frontmatter)
- **Tools**: Full read/write/execute access plus Trellis MCP tools (claim_task, get_issue, get_next_available_issue, complete_task, append_issue_log, append_modified_files, update_issue, list_issues), Perplexity, AskUserQuestion
- **System prompt content extracted from skill**: Security principles, forbidden patterns, quality standards, testing guidelines (consolidated from `testing-guidelines.md`), code documentation guidelines (consolidated from `code-documentation-guidelines.md`), error handling rules, "do not commit" constraint
- **What stays in the skill**: The specific Trellis workflow steps (claim, research, plan, implement, complete), structured output format, Trellis-specific process

### 2. `trellis-default-reviewer`
- **Purpose**: Read-only analysis of code, issues, and plans
- **Used by**: `issue-implementation-orchestration` for code review (`issue-implementation-review`), issue verification (`issue-creation-review` via `issue-creation-orchestration`), and implementation planning (`issue-implementation-planner`)
- **Skills**: None preloaded (the orchestrator specifies which skill to load at spawn time via the prompt, since this agent serves three different review skills)
- **Tools**: Read-only tools (Read, Glob, Grep) plus Trellis MCP read tools (get_issue, list_issues), Perplexity
- **System prompt content**: Evidence-based analysis, specific file references, actionable output, concise structured reporting, no implementation/modification of files

### 3. `trellis-default-author`
- **Purpose**: Creating/updating Trellis issues and documentation
- **Used by**: `issue-creation-orchestration` for issue creation (`issue-creation`) and `issue-implementation-orchestration` for documentation updates (`docs-updater`)
- **Skills**: None preloaded (the orchestrator specifies which skill at spawn time)
- **Tools**: Read + Write + Edit + Bash + Glob + Grep + Trellis MCP write tools (create_issue, get_issue, update_issue, list_issues) + Perplexity + AskUserQuestion
- **System prompt content**: Research-first approach, codebase-as-source-of-truth, concise writing, no over-engineering

## Orchestration Skill Updates

Both orchestration skills need updates to:

1. **Replace `subagent_type: "general-purpose"` with the appropriate default Trellis agent type** in all subagent spawn instructions
2. **Remove the Subagent Spawn Protocol** (preamble, verification, kill-and-replace dance) — since the `skills` frontmatter on the developer agent preloads the skill, and the reviewer/author agents receive their skill via the orchestrator's prompt, the elaborate invocation protocol is no longer needed
3. **Add documentation about agent type configurability** — explain that the default agent types can be overridden by the user specifying a different agent type, and how to do so
4. **Update resume instructions** — resumed agents no longer need skill re-invocation context; they already have their behavioral guardrails from the agent type

### `issue-implementation-orchestration` changes:
- Task implementation spawns: `subagent_type: "trellis-default-developer"`
- Review spawns: `subagent_type: "trellis-default-reviewer"`
- Planner spawns: `subagent_type: "trellis-default-reviewer"`
- Docs-updater spawns: `subagent_type: "trellis-default-author"`
- Resume spawns: Use the same agent type as the original spawn (already handled by Task tool resume)
- Remove Section "Subagent Spawn Protocol" entirely
- Remove all references to the Skill tool and skill invocation preamble from spawn prompt templates

### `issue-creation-orchestration` changes:
- Issue creation spawns: `subagent_type: "trellis-default-author"`
- Review spawns: `subagent_type: "trellis-default-reviewer"`

## Acceptance Criteria

1. Three agent definition files exist in `plugins/task-trellis/agents/`:
   - `trellis-default-developer.md`
   - `trellis-default-reviewer.md`
   - `trellis-default-author.md`
2. Each agent has appropriate YAML frontmatter: `name`, `description`, `tools`, and `skills` (where applicable)
3. The `trellis-default-developer` agent's system prompt includes consolidated testing guidelines and code documentation guidelines (content from the separate .md files)
4. The `trellis-default-developer` agent preloads the `issue-implementation` skill via the `skills` frontmatter field
5. Both orchestration skills (`issue-implementation-orchestration`, `issue-creation-orchestration`) use the new agent types instead of `general-purpose`
6. The Subagent Spawn Protocol section is removed from `issue-implementation-orchestration`
7. All spawn prompt templates in orchestration skills are simplified (no skill invocation preamble, no verification/kill-and-replace instructions)
8. Skills retain ALL of their existing `allowed-tools` — no tools are removed from any skill's frontmatter
9. Orchestration skills document that the default agent types can be overridden by the user

## Implementation Guidance

- Agent files follow the standard Claude Code agent Markdown format with YAML frontmatter
- The `skills` frontmatter field injects skill content at startup (the skill's SKILL.md content, but NOT referenced files like testing-guidelines.md — those must be consolidated into the agent prompt)
- The `tools` field in agent frontmatter uses the tool names as they appear in Claude Code (e.g., `Read`, `Edit`, `mcp__task-trellis__get_issue`)
- Do not specify `model` — agents inherit from the parent conversation
- Do not specify `permissionMode` — agents inherit from the parent conversation (same as general-purpose behavior)
- Names use `trellis-default-` prefix to signal they are default implementations meant to be swappable

## Testing Requirements

- Verify agent files are valid Markdown with proper YAML frontmatter
- Verify orchestration skills reference the correct agent type names
- Verify no tools were removed from any skill's `allowed-tools`
- Verify the Subagent Spawn Protocol section is fully removed from `issue-implementation-orchestration`

## Dependencies

None — this is a standalone feature.