---
id: F-issue-writer-agent-reviewer
title: Issue Writer Agent & Reviewer Refinement
status: done
priority: high
parent: none
prerequisites: []
affectedFiles:
  plugins/task-trellis/agents/trellis-default-issue-writer.md:
    Created new agent file with YAML frontmatter (name, description, 7 tools)
    and system prompt containing Skill Invocation Mandate, Error Abort Mandate,
    Issue Writing Guidelines, and Testing Guidelines
  plugins/task-trellis/agents/trellis-default-reviewer.md: Updated frontmatter
    description to reflect implementation-review focus. Updated opening
    paragraph to say 'review code implementations' instead of 'review code,
    issues, and plans'. Inlined full testing guidelines (unit tests, integration
    tests, performance tests, general philosophy) after Analysis Guidelines
    section. Inlined full code documentation guidelines (what to document, how
    to document, what not to do, remember section) after Testing Guidelines
    section.
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
  plugins/task-trellis/skills/issue-creation/task.md: Removed
    testing-guidelines.md link from line 166 (kept surrounding text), removed
    entire Testing section (lines 195-197) that solely referenced the guideline
    file
  plugins/task-trellis/skills/issue-creation/feature.md: Removed testing-guidelines.md link from line 94 (kept surrounding text)
  plugins/task-trellis/skills/issue-implementation-review/SKILL.md:
    Removed testing-guidelines.md link from line 107 and
    code-documentation-guidelines.md link from line 125 (kept surrounding text
    for both)
  plugins/task-trellis/skills/issue-creation/testing-guidelines.md: Deleted - guidelines now embedded in trellis-default-issue-writer agent
  plugins/task-trellis/skills/issue-implementation-review/testing-guidelines.md: Deleted - guidelines now embedded in trellis-default-reviewer agent
  plugins/task-trellis/skills/issue-implementation-review/code-documentation-guidelines.md: Deleted - guidelines now embedded in trellis-default-reviewer agent
log:
  - "Auto-completed: All child tasks are complete"
schema: v1.0
childrenIds:
  - T-create-trellis-default-issue
  - T-remove-guideline-references
  - T-update-orchestration-skills
  - T-update-trellis-default
created: 2026-02-07T21:24:54.014Z
updated: 2026-02-07T21:24:54.014Z
---

## Overview

Create a new `trellis-default-issue-writer` agent type and refine the existing `trellis-default-reviewer` agent to specialize each agent for its actual role. Update orchestration skills to use the correct agent types, and consolidate duplicate guideline files into agents.

This continues the work from F-default-trellis-subagent-types, which established the pattern of embedding behavioral guidelines in agents rather than skills. Two areas still have duplicate guidelines that should be in agents:

1. **Issue creation** — `issue-creation/testing-guidelines.md` is referenced by `task.md` and `feature.md` for scoping test tasks
2. **Issue implementation review** — `testing-guidelines.md` and `code-documentation-guidelines.md` are referenced by the review skill for evaluating code

The `trellis-default-reviewer` agent is currently shared across three roles (planner, implementation reviewer, issue reviewer), making it too generic to embed role-specific guidelines.

## Design Principle

Same as F-default-trellis-subagent-types: **Agents and skills are orthogonal.** Agents define HOW to work (standards, guidelines, behavioral guardrails). Skills define WHAT workflow to follow. Neither preloads the other.

## Changes Required

### 1. Create `trellis-default-issue-writer` agent (`plugins/task-trellis/agents/trellis-default-issue-writer.md`)

**Purpose**: Writing and reviewing Trellis issues — used by both `issue-creation` and `issue-creation-review` skills.

**Tools** (overlap between what both skills need — the agent should only have tools required by both consumers):
- `Skill`
- `Read`
- `Glob`
- `Grep`
- `mcp__task-trellis__get_issue`
- `mcp__task-trellis__list_issues`
- `mcp__perplexity-ask__perplexity_ask`

**System prompt content:**
- Skill Invocation Mandate + Error Abort Mandate (same pattern as other agents)
- Issue writing guidelines adapted from the existing `trellis-default-author` agent's principles:
  - Research-first approach (search codebase before creating/reviewing anything)
  - Codebase as source of truth (parent issues may be outdated)
  - Concise writing (KISS/YAGNI)
- Testing guidelines for issue scoping — use the `issue-creation/testing-guidelines.md` version (focused on *planning/scoping* tests, not *writing* them — e.g., "create tasks" language, not "write tests" language). Inline the full content, do not reference the file.

**Important**: Skills retain ALL their existing `allowed-tools`. The creation skill still gets `Task`, `AskUserQuestion`, `create_issue`, `update_issue`, etc. The review skill still gets `WebFetch`, `WebSearch`, `LS`, `TodoWrite`, etc. The agent only has the shared subset.

### 2. Update `trellis-default-reviewer` agent (`plugins/task-trellis/agents/trellis-default-reviewer.md`)

**Purpose**: Now exclusively for implementation review (code review via `issue-implementation-review` skill). No longer used for planning or issue review.

**Tools**: Keep existing tools unchanged (`Skill`, `Read`, `Glob`, `Grep`, `mcp__task-trellis__get_issue`, `mcp__task-trellis__list_issues`, `mcp__perplexity-ask__perplexity_ask`).

**System prompt changes:**
- Update description to reflect implementation-review focus
- Keep existing analysis guidelines (evidence-based, actionable output, concise structured reporting, read-only constraint)
- **Add** testing guidelines — use the `issue-implementation-review/testing-guidelines.md` version (focused on *evaluating* test quality in code, not *scoping* test tasks). Inline the full content.
- **Add** code documentation guidelines — use `issue-implementation-review/code-documentation-guidelines.md` content. Inline the full content.

### 3. Update `issue-creation-orchestration` skill (`plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md`)

- Change issue creation spawns from `trellis-default-author` to `trellis-default-issue-writer`
- Change review spawns from `trellis-default-reviewer` to `trellis-default-issue-writer`
- Update the Agent Types table accordingly
- Update the agent type configurability documentation

### 4. Update `issue-implementation-orchestration` skill (`plugins/task-trellis/skills/issue-implementation-orchestration/SKILL.md`)

- Change planner spawns from `trellis-default-reviewer` to the built-in `Explore` subagent type
- Keep implementation review spawns as `trellis-default-reviewer` (unchanged)
- Keep task implementation as `trellis-default-developer` (unchanged)
- Keep docs-updater as `trellis-default-author` (unchanged)
- Update the Agent Types table accordingly
- Note in configurability docs that the planner uses the built-in `Explore` type (not a Trellis agent), since its role is purely read-only codebase exploration and any additional tools can be provided via the skill

### 5. Remove guideline references from skills

- **`issue-creation/task.md`**: Remove the reference to `testing-guidelines.md` (line 166: `Note: Tests are included within tasks only where meaningful complexity exists, per the [Testing Guidelines](testing-guidelines.md).` and line 197: `Before creating any testing-related tasks, read the [Testing Guidelines](testing-guidelines.md).`). The testing guidelines are now in the agent.
- **`issue-creation/feature.md`**: Remove the reference to `testing-guidelines.md` (line 94: `- **Testing Requirements** - What meaningful tests are needed (see [Testing Guidelines](testing-guidelines.md))`). The testing guidelines are now in the agent.
- **`issue-implementation-review/SKILL.md`**: Remove references to `testing-guidelines.md` (line 107: `(see [Testing Guidelines](testing-guidelines.md))`) and `code-documentation-guidelines.md` (line 125: `against the [Code Documentation Guidelines](code-documentation-guidelines.md)`). The guidelines are now in the reviewer agent.

### 6. Delete guideline files that are now fully embedded in agents

- Delete `plugins/task-trellis/skills/issue-creation/testing-guidelines.md`
- Delete `plugins/task-trellis/skills/issue-implementation-review/testing-guidelines.md`
- Delete `plugins/task-trellis/skills/issue-implementation-review/code-documentation-guidelines.md`

## What Does NOT Change

- `trellis-default-developer` agent — already has its guidelines, no changes needed
- `trellis-default-author` agent — stays as-is, used exclusively by `docs-updater`
- `issue-implementation` skill — already cleaned up in the prior feature
- `issue-creation/SKILL.md` — the main skill file is unchanged, only its sub-files (`task.md`, `feature.md`) lose guideline references
- `issue-creation-review/SKILL.md` — unchanged, it keeps all its `allowed-tools`
- `issue-implementation-review/SKILL.md` — only the guideline references are removed, all `allowed-tools` preserved
- `issue-implementation-planner/SKILL.md` — unchanged, keeps all `allowed-tools`
- All skills' `allowed-tools` frontmatter — no tools removed from any skill

## Acceptance Criteria

1. `trellis-default-issue-writer.md` exists in `plugins/task-trellis/agents/` with proper YAML frontmatter (name, description, tools)
2. The issue-writer agent's tools are ONLY the shared subset: Skill, Read, Glob, Grep, get_issue, list_issues, Perplexity
3. The issue-writer agent's system prompt includes Skill Invocation Mandate, Error Abort Mandate, issue writing guidelines, and testing guidelines (issue-scoping version)
4. `trellis-default-reviewer.md` is updated with testing guidelines and code documentation guidelines embedded in its system prompt
5. `trellis-default-reviewer.md` description reflects its implementation-review focus
6. `issue-creation-orchestration` uses `trellis-default-issue-writer` for both creation and review spawns
7. `issue-implementation-orchestration` uses `Explore` for planner spawns (not `trellis-default-reviewer`)
8. `issue-implementation-orchestration` Agent Types table is updated
9. Guideline references removed from `task.md`, `feature.md`, and `issue-implementation-review/SKILL.md`
10. Guideline files deleted: `issue-creation/testing-guidelines.md`, `issue-implementation-review/testing-guidelines.md`, `issue-implementation-review/code-documentation-guidelines.md`
11. No tools removed from any skill's `allowed-tools` frontmatter
12. All agents include the `Skill` tool
13. All agents include Skill Invocation Mandate and Error Abort Mandate

## Implementation Guidance

- Follow the established agent file format: YAML frontmatter with `name`, `description`, `tools`, then markdown body for system prompt
- Do NOT use `skills` frontmatter — agents and skills are orthogonal
- Do not specify `model` or `permissionMode` — agents inherit from parent
- Use `trellis-default-` prefix for the new agent name
- When inlining testing guidelines, use the version appropriate to the agent's role (issue-scoping for issue-writer, code-evaluation for reviewer)
- The `Explore` subagent type is a built-in Claude Code type, not defined in the agents directory