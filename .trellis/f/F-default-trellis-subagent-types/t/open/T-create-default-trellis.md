---
id: T-create-default-trellis
title: Create default Trellis subagent type definitions
status: open
priority: high
parent: F-default-trellis-subagent-types
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-07T19:05:38.901Z
updated: 2026-02-07T19:05:38.901Z
---

## Overview

Create three agent definition Markdown files in `plugins/task-trellis/agents/`. These define the default subagent types that orchestration skills will spawn instead of `general-purpose`.

## Files to Create

### 1. `plugins/task-trellis/agents/trellis-default-developer.md`

**Purpose**: Code implementation agent — writing, testing, debugging code changes.

**YAML frontmatter must include:**
- `name: trellis-default-developer`
- `description`: Code implementation agent for Task Trellis — writing, testing, and debugging code changes
- `skills`: `[issue-implementation]` (preloads the skill's SKILL.md content at startup)
- `tools`: Full read/write/execute access:
  - `Read`, `Edit`, `Write`, `Bash`, `Glob`, `Grep`
  - `Task`, `TaskOutput`, `TaskStop`
  - Trellis MCP tools: `mcp__task-trellis__claim_task`, `mcp__task-trellis__get_issue`, `mcp__task-trellis__get_next_available_issue`, `mcp__task-trellis__complete_task`, `mcp__task-trellis__append_issue_log`, `mcp__task-trellis__append_modified_files`, `mcp__task-trellis__update_issue`, `mcp__task-trellis__list_issues`
  - Perplexity: `mcp__perplexity-ask__perplexity_ask`
  - `AskUserQuestion`
- Do NOT specify `model` or `permissionMode` (inherit from parent)

**System prompt content** (body of the Markdown file after frontmatter):

Extract and consolidate the following from `plugins/task-trellis/skills/issue-implementation/SKILL.md` into the agent's system prompt. These are behavioral guardrails that should persist across agent resumes:

1. **Testing Guidelines** — Consolidate the full content of `plugins/task-trellis/skills/issue-implementation/testing-guidelines.md` directly into the agent prompt (the `skills` frontmatter only injects SKILL.md, NOT referenced files)
2. **Code Documentation Guidelines** — Consolidate the full content of `plugins/task-trellis/skills/issue-implementation/code-documentation-guidelines.md` directly into the agent prompt
3. **Security & Performance Principles** section from SKILL.md (Security Always list + Forbidden Patterns list)
4. **Quality Standards** — Research First, Purposeful Testing, Quality Checks
5. **Error and Failure Handling** rules block (the `<rules>` section about stopping on errors, never working around failures, etc.)
6. **Do Not Commit** constraint — "Do NOT commit changes - leave all changes uncommitted for review"

**What stays in the skill (do NOT move to agent):** The Trellis workflow steps (Claim → Research → Implement → Complete), structured output format, input handling, process sections.

### 2. `plugins/task-trellis/agents/trellis-default-reviewer.md`

**Purpose**: Read-only analysis agent for code review, issue verification, and implementation planning.

**YAML frontmatter must include:**
- `name: trellis-default-reviewer`
- `description`: Read-only analysis agent for Task Trellis — code review, issue verification, and implementation planning
- `tools`: Read-only tools only:
  - `Read`, `Glob`, `Grep`
  - Trellis MCP read tools: `mcp__task-trellis__get_issue`, `mcp__task-trellis__list_issues`
  - Perplexity: `mcp__perplexity-ask__perplexity_ask`
- No `skills` field (orchestrator specifies which skill at spawn time via prompt)
- Do NOT specify `model` or `permissionMode`

**System prompt content:**
- Evidence-based analysis: always cite specific file paths and line numbers
- Actionable output: every finding must include a concrete suggestion
- Concise structured reporting: use structured format (sections, bullet points)
- Read-only posture: do NOT modify files, write code, or make changes — analysis only
- No implementation: if you identify an issue, describe it; do not fix it

### 3. `plugins/task-trellis/agents/trellis-default-author.md`

**Purpose**: Agent for creating/updating Trellis issues and documentation.

**YAML frontmatter must include:**
- `name: trellis-default-author`
- `description`: Author agent for Task Trellis — creating and updating issues and documentation
- `tools`: Read + limited write:
  - `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`
  - Trellis MCP write tools: `mcp__task-trellis__create_issue`, `mcp__task-trellis__get_issue`, `mcp__task-trellis__update_issue`, `mcp__task-trellis__list_issues`
  - Perplexity: `mcp__perplexity-ask__perplexity_ask`
  - `AskUserQuestion`
- No `skills` field (orchestrator specifies which skill at spawn time)
- Do NOT specify `model` or `permissionMode`

**System prompt content:**
- Research-first approach: always search the codebase before creating/modifying issues
- Codebase-as-source-of-truth: parent issues may be outdated; the codebase reflects reality
- Concise writing: be direct and specific in issue descriptions
- No over-engineering: follow KISS/YAGNI principles
- Author-not-implementer boundary: create issues and documentation; do not implement code changes

## Acceptance Criteria

1. All three files exist at `plugins/task-trellis/agents/{name}.md`
2. Each file has valid YAML frontmatter with `name`, `description`, and `tools`
3. `trellis-default-developer.md` has `skills: [issue-implementation]` in frontmatter
4. `trellis-default-developer.md` system prompt includes consolidated testing guidelines and code documentation guidelines (full content, not references to external files)
5. `trellis-default-developer.md` system prompt includes security principles, forbidden patterns, quality standards, error handling rules, and do-not-commit constraint
6. `trellis-default-reviewer.md` has ONLY read-only tools (no Edit, Write, Bash)
7. `trellis-default-author.md` has write tools but NOT implementation-specific Trellis tools (no `claim_task`, `complete_task`, `append_issue_log`, `append_modified_files`)
8. No file specifies `model` or `permissionMode`

## Out of Scope

- Updating orchestration skills to reference these agents (handled by separate tasks)
- Modifying the `issue-implementation` SKILL.md content
- Removing `testing-guidelines.md` or `code-documentation-guidelines.md` files (they stay as-is for direct skill users)