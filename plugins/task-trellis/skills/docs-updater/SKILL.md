---
name: docs-updater
description: Reviews completed feature work and updates documentation files (CLAUDE.md, README.md, docs/) as needed. Invoked after implementation is complete.
allowed-tools:
  - Glob
  - Grep
  - Read
  - Edit
  - Write
  - Bash
  - mcp__perplexity-ask__perplexity_ask
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__list_issues
---

# Documentation Updater

Review completed feature work and update documentation files as needed. This skill is invoked by the orchestration workflow after implementation is complete and before the feature is marked done.

## Goal

Ensure documentation stays current with code changes by reviewing what was implemented and making targeted updates to relevant documentation files.

## Required Inputs

- **Issue ID**: The Feature or Epic ID that was just implemented (e.g., "F-add-user-auth")
- **Additional Context** (optional): Specific areas to focus on or notes from implementation

## Subagent Limitations

This skill runs as a subagent and cannot ask questions directly. If critical information is missing or documentation changes require human judgment, include these concerns in the output summary for the orchestrator to address.

## Documentation Files to Maintain

- `CLAUDE.md` - Project instructions for Claude Code
- `README.md` - Project readme
- `docs/**` - Any files in the docs folder

## Process

### 1. Gather Context on What Changed

Understand the scope of changes made during the feature implementation:

- **Get the issue**: Use `get_issue` to retrieve the feature/epic details including:
  - Title and description (what was implemented)
  - Child tasks and their modified files
  - Implementation log entries
- **Get git diff**: Use `git diff main...HEAD` (or appropriate base branch) to see all code changes
- **List modified files**: Compile a complete list of files that were created or modified

### 2. Analyze Documentation Impact

Evaluate whether documentation updates are needed:

- **Behavior changes**: Have any documented behaviors been modified?
- **API changes**: Have any APIs, endpoints, or interfaces changed?
- **Configuration changes**: Have any settings, options, or configurations changed?
- **New features**: Are there new features that users need to know about?
- **Removed features**: Has anything been deprecated or removed?
- **Usage patterns**: Have any workflows or usage patterns changed?

### 3. Identify Documentation Files to Update

For each type of documentation, assess relevance:

**CLAUDE.md** (Agent Steering Spec):

CLAUDE.md should be a steering spec for agents, not a code index. Think "minimum instructions the agent always needs" and push everything else to linked docs.

*Core Principles:*
- Keep it short enough to fit comfortably in context (aim ≤150 lines)
- Make every line actionable: commands, rules, gotchas; avoid prose that doesn't change behavior
- Do not mirror the README or list files; link to existing docs instead
- Mental model: "If this disappeared, what would cause the agent to start making bad choices?"

*Recommended Structure:*
1. **Project overview** (1-3 sentences) - What the app is, main tech stack, key constraints
2. **How to run, build, and test** - Explicit commands in code blocks, including non-obvious flags
3. **Conventions and boundaries** - Code style not enforced by tooling, folder layout, naming patterns, architectural rules. Include "Always / Ask first / Never" lists for risky operations (DB schema, auth, infra, secrets, CI)
4. **Task workflow for agents** - Branching/commit style, PR expectations, whether to run tests/linters before proposing changes
5. **Links to deeper docs** - Point to README, docs/, ADRs, or external URLs instead of duplicating content

*What to Remove:*
- Raw listings of files or directories beyond high-level structure
- Generated agent output verbatim (summaries, long path lists from scans)
- Obvious advice ("write clean code", "add comments when appropriate")

*What to Keep (but compress):*
- Very short "Project structure" section, only for key folders and special patterns
- Non-obvious layering rules (e.g., "components may import hooks, but hooks must not import components")

*What to Push Elsewhere:*
- Detailed API docs, schema docs, ADRs, design notes → put in docs/ and link
- Domain tutorials or user guides

*Patterns That Work Well:*
- Progressive disclosure: Root file is minimal; deeper topics live in separate files linked from the root
- Clear precedence: For monorepos, use nested CLAUDE.md where "closest file wins" for local instructions
- Explicit guardrails work better than vague cautions: "Ask before adding new runtime dependencies", "Never edit GitHub Actions workflows"

**README.md**:
- Installation or setup changes
- New features or capabilities
- Configuration options
- Usage examples

**docs/** (Living Specification):

The `/docs` folder serves as the living specification and source of truth for the project. All developers and AI agents should turn to these docs when they need information about how the system is supposed to work.

*Purpose:*
- Documents the intended behavior, architecture, and design decisions of the system
- Acts as the authoritative reference that code should conform to
- Provides context that helps agents make correct decisions

*What Belongs in docs/:*
- API documentation and specifications
- Architecture documentation and diagrams
- Design decisions and ADRs (Architecture Decision Records)
- User guides and tutorials
- Reference materials and schema documentation
- Domain-specific knowledge and business rules
- Integration guides and protocols

*Maintenance Guidelines:*
- Keep docs synchronized with actual system behavior
- When code changes conflict with docs, determine which is correct (sometimes the doc is the spec and code needs fixing; other times the doc is stale)
- Prefer updating existing docs over creating new ones to avoid fragmentation
- Use clear, consistent naming and organization
- Link from CLAUDE.md to relevant docs rather than duplicating content
- If information isn't in the docs and an agent needs it, that's a signal the docs may need updating (consult the user first)

### 4. Make Documentation Updates

For each file requiring updates:

- **Read the existing documentation** to understand current content and style
- **Make targeted edits** that integrate naturally with existing content
- **Follow the existing style** (formatting, tone, level of detail)
- **Keep updates focused** on what actually changed
- **Avoid over-documenting** - only document what's necessary

### 5. Generate Summary

Compile the results of your documentation review.

## Output Format

Provide a summary of documentation updates in the following format:

### When Files Were Updated

```
## Documentation Updates

### Files Updated
- `README.md`: [Brief description of what was updated]
- `docs/api.md`: [Brief description of what was updated]
- `CLAUDE.md`: [Brief description of what was updated]

### Summary
[2-3 sentence overview of documentation changes and why they were needed]

### Notes for Review
[Any areas of uncertainty or items that may need human review - omit if none]
```

### When No Updates Needed

```
## Documentation Updates

No documentation updates needed.

### Analysis
The changes made during this implementation do not affect any documented behaviors, APIs, configurations, or usage patterns.

### Files Reviewed
- [List of documentation files checked]
```

## Guidelines

- **Minimal changes**: Only update documentation that is directly affected by code changes
- **Evidence-based**: Base updates on actual code changes, not assumptions
- **Style consistency**: Match the existing documentation style and format
- **No placeholders**: Do not add TODO comments or placeholder text
- **Actionable output**: The summary should clearly communicate what was done
