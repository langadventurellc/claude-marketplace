---
name: docs-updater
description: Reviews completed feature work and updates documentation files (CLAUDE.md, README.md, docs/) as needed. Invoked after implementation is complete.
context: fork
agent: general-purpose
allowed-tools:
  - Glob
  - Grep
  - Read
  - Edit
  - Write
  - Bash
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

**CLAUDE.md**:
- New coding patterns or conventions
- New tools, commands, or workflows
- Changes to project structure
- Updated instructions for Claude Code

**README.md**:
- Installation or setup changes
- New features or capabilities
- Configuration options
- Usage examples

**docs/**:
- API documentation
- Architecture documentation
- User guides
- Reference materials

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
