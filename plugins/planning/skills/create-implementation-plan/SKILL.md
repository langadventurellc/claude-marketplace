---
name: create-implementation-plan
description: Generates a detailed, actionable implementation plan for a non-trivial coding task. Use when asked to "generate implementation plan" or "plan coding task". Invoked by the trellis-issue-writer when authoring a Trellis Task that involves code changes and is not obviously trivial. Produces an ## Implementation Plan block suitable for inlining directly into the task description — not as an attachment or standalone file.
model: opus
effort: high
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

Generate a detailed, actionable `## Implementation Plan` block for a Trellis coding task. The plan is inlined verbatim into the task description so that a downstream developer can implement the task without independent research.

## Input Contract

The caller provides:

- **Task title** — the title of the Trellis task being authored
- **Scope / acceptance-criteria paragraph** — the draft description written by the issue writer, including what the change achieves and how success is measured
- **Parent feature/epic IDs and titles** — for context on motivation and scope boundaries
- **Relevant attachment paths** — any files forwarded as primary source material; read these first, before researching the codebase
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

Produce the following block and nothing else. Inline it verbatim into the task body under `## Implementation Plan` — do not save it as a file or attachment.

```markdown
## Implementation Plan

### Research Summary
- **Files examined**: [list every file read during research]
- **Key findings**: [patterns and conventions identified, similar implementations reviewed, external docs consulted]
- **Assumptions**: [decisions made where multiple approaches were possible; flag anything uncertain]

### Overview
[2–3 sentences: what this implementation achieves and how it fits into the broader feature]

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

The plan you produce is the blueprint. The downstream developer trusts it unless direct evidence contradicts it — they will not re-research unless the plan demonstrably conflicts with what they find on disk. Precision matters more than breadth: a plan that names the exact function and line range beats a plan that lists ten vaguely relevant files.
