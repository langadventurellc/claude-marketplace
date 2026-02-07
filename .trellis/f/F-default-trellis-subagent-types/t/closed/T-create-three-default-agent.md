---
id: T-create-three-default-agent
title: Create three default agent definition files
status: done
priority: high
parent: F-default-trellis-subagent-types
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
log:
  - Created three default agent definition files in
    plugins/task-trellis/agents/. Each follows the Claude Code agent Markdown
    format with YAML frontmatter (name, description, tools) and a system prompt
    body. All three include the Skill Invocation Mandate and Error Abort
    Mandate. The developer agent inlines the full content of
    testing-guidelines.md and code-documentation-guidelines.md, plus security
    principles, forbidden patterns, quality standards, and error handling rules.
    The reviewer agent is read-only with evidence-based analysis guidelines. The
    author agent includes research-first, codebase-as-source-of-truth, and
    concise writing guidelines. No skills, model, or permissionMode fields are
    specified in any agent.
schema: v1.0
childrenIds: []
created: 2026-02-07T20:23:33.386Z
updated: 2026-02-07T20:23:33.386Z
---

Create three agent definition Markdown files in `plugins/task-trellis/agents/`:

### Files to Create

1. **`trellis-default-developer.md`**
   - Purpose: Code implementation — writing, testing, debugging code changes
   - YAML frontmatter: `name`, `description`, `tools` (Skill, Task, Read, Edit, Write, Bash, Glob, Grep, AskUserQuestion, plus Trellis MCP tools: mcp__plugin_task-trellis_task-trellis__claim_task, mcp__plugin_task-trellis_task-trellis__get_issue, mcp__plugin_task-trellis_task-trellis__get_next_available_issue, mcp__plugin_task-trellis_task-trellis__complete_task, mcp__plugin_task-trellis_task-trellis__append_issue_log, mcp__plugin_task-trellis_task-trellis__append_modified_files, mcp__plugin_task-trellis_task-trellis__update_issue, mcp__plugin_task-trellis_task-trellis__list_issues, plus Perplexity tools)
   - No `skills` frontmatter field (agents and skills are orthogonal)
   - No `model` or `permissionMode` fields
   - System prompt must include:
     - Skill Invocation Mandate + Error Abort Mandate
     - Security & performance principles (moved from `issue-implementation` skill)
     - Forbidden patterns (moved from `issue-implementation` skill)
     - Quality standards (moved from `issue-implementation` skill)
     - Full content of `testing-guidelines.md` (inlined, not referenced)
     - Full content of `code-documentation-guidelines.md` (inlined, not referenced)
     - Error and failure handling rules

2. **`trellis-default-reviewer.md`**
   - Purpose: Read-only analysis of code, issues, and plans
   - YAML frontmatter tools: Skill, Read, Glob, Grep, plus Trellis MCP read tools (get_issue, list_issues), Perplexity
   - System prompt must include:
     - Skill Invocation Mandate + Error Abort Mandate
     - Evidence-based analysis guidelines
     - Actionable output requirements
     - Concise structured reporting
     - No implementation/modification of files constraint

3. **`trellis-default-author.md`**
   - Purpose: Creating/updating Trellis issues and documentation
   - YAML frontmatter tools: Skill, Task, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, plus Trellis MCP write tools (create_issue, get_issue, update_issue, list_issues), Perplexity
   - System prompt must include:
     - Skill Invocation Mandate + Error Abort Mandate
     - Research-first approach
     - Codebase-as-source-of-truth
     - Concise writing (KISS/YAGNI)

### Key Constraints
- Agent files follow standard Claude Code agent Markdown format with YAML frontmatter
- Do NOT use `skills` frontmatter field
- Names use `trellis-default-` prefix
- All agents include the `Skill` tool
- `testing-guidelines.md` and `code-documentation-guidelines.md` content must be inlined into the developer agent, not referenced