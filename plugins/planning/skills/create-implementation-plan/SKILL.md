---
name: create-implementation-plan
description: Generates a detailed, actionable implementation plan for a non-trivial coding task. Invoked by the implementer (issue-implementation skill) at claim time when the claimed task does not meet the trivial-edit skip criteria. Returns an ## Implementation Plan block consumed directly by the developer — not stored on the Trellis task.
model: opus
effort: xhigh
context: fork
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - WebFetch
  - WebSearch
  - AskUserQuestion
---

# Create Implementation Plan

Generate a detailed, actionable `## Implementation Plan` block for a Trellis coding task that has just been claimed for implementation. The plan is consumed by the developer in the same run; it is not written back to the Trellis task body.

## Input Contract

The caller (the developer who just claimed the task) provides:

- **Task title** — the title of the claimed Trellis task
- **Task body** — the full claimed task description, including scope and acceptance criteria
- **Parent feature/epic IDs and titles** — for context on motivation and scope boundaries
- **Relevant attachment paths** — any files referenced in the task's `## Attachments` section; read these first, before researching the codebase
- **Repo root** — the working directory for all file lookups (defaults to the current working directory if not provided)

## Research Phase (mandatory before producing any output)

Do NOT produce the plan until this phase is complete. Perform all steps before writing a single line of output.

### Step 1 — Consume attachments

If any attachment paths were provided, read each one before touching the codebase. Treat attachments as primary source material: a design file constrains the implementation; a spec document's requirements are load-bearing; an existing asset should be reused, not recreated.

### Step 2 — Analyze parent context

Read the task description and parent feature/epic to understand:

- Motivation (why this change exists)
- Scope boundaries (what is explicitly in- and out-of-scope)
- Acceptance criteria (how completion is verified)

### Step 3 — Study the codebase

Use `Glob`, `Grep`, `Read`, and `Bash` to:

- Locate files likely affected by the change
- Identify naming conventions, directory structure, and import patterns
- Find similar existing implementations to follow as models
- Trace dependencies and call chains for affected components
- Check for relevant configuration, tests, and build artifacts

Use WebSearch, WebFetch, or any MCP info-source present in the session to look up current library docs, API schemas, or external specifications when the task touches external dependencies.

### Step 4 — Verify file locations

Before naming any file in the plan, confirm it exists (for MODIFY/DELETE) or that its intended parent directory exists (for CREATE). A plan with a wrong path is worse than no plan.

## Output Template

Produce the following block and nothing else. The developer who invoked this skill will read it directly to drive implementation — do not save it to a file, write it back to the Trellis task, or attach it.

```markdown
## Implementation Plan

### Research Summary
- **Files examined**: [list every file read during research]
- **Key findings**: [patterns and conventions identified, similar implementations reviewed, external docs consulted]
- **Assumptions**: [decisions made where multiple approaches were possible; flag anything uncertain]

### Prerequisites
[Required dependencies, tools, or setup steps with version requirements if relevant. Omit section if none.]

### File Modifications

#### 1. [CREATE | MODIFY | DELETE] `path/to/file`
**Purpose**: [why this file changes]
**Changes**:
- [specific change with exact location context — e.g., "after the last import statement", "in the `createUser` method, replace lines 23–45"]
- [additional change]
**Depends on**: [other numbered items this change depends on, if any]
**Impacts**: [downstream files affected by this change]

#### 2. [CREATE | MODIFY | DELETE] `path/to/file`
[repeat pattern for each file]

### Implementation Order
1. [first file or group — no dependencies]
2. [depends on #1]
3. [depends on #2, etc.]
```

## What NOT to Include

- Actual code — unless a brief pattern example is essential to disambiguate an ambiguous change
- Generic best-practice advice (error handling, testing philosophy, etc.) unless it is specific to this task
- Philosophical discussion or motivation beyond what fits in the Overview
- Speculation about future changes outside this task's scope

Be prescriptive. A vague plan is a broken plan.

## Quality Checklist

Verify before finalizing the plan:

- [ ] Every file in the dependency chain is accounted for (no orphaned changes)
- [ ] A developer could identify exactly where each change goes without additional research
- [ ] Implementation order respects all dependency relationships in the DAG
- [ ] Error handling and edge cases specific to this change are addressed
- [ ] Configuration, migration, or deployment needs are specified if applicable
- [ ] No file paths are speculative — each has been verified to exist or its parent directory confirmed

## Closing Guidance

The plan you produce is the blueprint. The developer who invoked you trusts it unless direct evidence contradicts it — they will not re-research unless the plan demonstrably conflicts with what they find on disk. Precision matters more than breadth: a plan that names the exact function and line range beats a plan that lists ten vaguely relevant files.
