---
name: issue-creation
description: Creates Trellis issues — projects, epics, features, or tasks — one hierarchy level at a time. Use when the user asks to create, decompose, or break down a project, epic, feature, or task in Trellis (e.g. "create a project", "create epics for P-…", "break down feature F-… into tasks", "decompose epic E-…"). Routes to the type-specific creation flow for the requested level only and stops there — does not auto-recurse to child levels.
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__create_issue
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__update_issue
  - mcp__plugin_task-trellis-teams_task-trellis__add_attachment
  - Read
  - Glob
  - Grep
  - Write
  - Bash
  - AskUserQuestion
---

# Create Trellis Issues

Create issues in the Trellis task management system. This skill supports creating all issue types: projects, epics, features, and tasks.

## Issue Type Hierarchy

Trellis uses a hierarchical issue structure:

```
Project -> Epic -> Feature -> Task
```

- **Project**: Top-level container representing a complete initiative
- **Epic**: Major work stream within a project
- **Feature**: Implementable functionality within an epic
- **Task**: Atomic unit of work (1-2 hours) within a feature

Each type can be created standalone or within its parent hierarchy.

## Determining Issue Type

Based on the user's request, determine which issue type to create:

| User Request                                                         | Issue Type | Reference                |
| -------------------------------------------------------------------- | ---------- | ------------------------ |
| "create a project", "new project", "set up project management"       | Project    | [project.md](project.md) |
| "create epics", "break down project into epics", "decompose project" | Epic       | [epic.md](epic.md)       |
| "create features", "break down epic into features", "decompose epic" | Feature    | [feature.md](feature.md) |
| "create tasks", "break down feature into tasks", "decompose feature" | Task       | [task.md](task.md)       |

## Instructions

1. **Identify the issue type** the user wants to create based on their request
2. **Inventory source materials** from the current conversation before creating any issues:
   - In-chat output from `planning:requirements-creation` or `planning:discovery`
   - User-supplied file paths (design files, screenshots, PDFs, spec docs)
   - Anything else the user referenced while scoping the work

   If planning output exists only as in-chat text, save it to a temp file (e.g., `/tmp/trellis-<timestamp>-requirements.md`) using `Write` before attaching. The type-specific file below specifies holder placement rules and `## Attachments` format.

3. **Validate the provided inputs** against the current codebase (see below)
4. **Read the type-specific file** (per the table above) and follow it.

## Validate Inputs

You will be given a plan, parent issue, or specification describing what to create. Research has been done before you were invoked — your job is to verify that input against the current codebase, not to re-research from scratch.

Spot-check before creating issues:

- **Verify key references**: Confirm 2-3 file paths, components, or patterns named in the input actually exist
- **Compare against reality**: The input may have been written before other work was completed — check whether assumed state still holds
- **Identify actual gaps**: Only create issues for work that genuinely needs to be done

**When you find discrepancies:**

- **Minor** (wrong path, renamed symbol): Adapt and continue
- **Major** (plan assumes missing state, work already done): **STOP** and alert the user

The codebase is the source of truth.

## Critical Rule: Create Only the Requested Issue Type

**STOP after creating the identified issue type.** Do not automatically create child issues.

- If the user asks to "create a project" → Create the project, then STOP
- If the user asks to "create epics for project P-123" → Create the epics, then STOP
- If the user asks to "create features for epic E-456" → Create the features, then STOP
- If the user asks to "create tasks for feature F-789" → Create the tasks, then STOP

**Do NOT continue to break down the hierarchy further.** Each level of decomposition requires a separate user request. After creating issues, report what was created and wait for further instructions.

## Common Principles

All issue types share these principles:

- **Default to coarser granularity** - Prefer fewer, larger issues that are easier for AI agents to orchestrate. Don't create many tiny issues.
- **Ask questions only when necessary** - Only ask when requirements are genuinely ambiguous, critical information is missing, or decisions have significant irreversible consequences.
- **Include acceptance criteria** - All issues should have measurable success criteria.
- **Create sequentially** - When creating multiple issues, do them one at a time, not in parallel.
- **No integration or performance tests** - Do not add integration or performance tests unless specifically requested in the input.
- **Do not create issues for version bumps** - Version bumps (to `plugin.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`, etc.) are handled at the end of implementation by the `planning:versioning` skill, not as standalone Trellis work. If the original requirements mention a version bump, drop it from the issue set — do not create a task, feature, or epic for it, even if the requirements ask for it explicitly.
