---
id: T-update-trellis-default
title: Update trellis-default-reviewer agent for implementation review focus
status: done
priority: high
parent: F-issue-writer-agent-reviewer
prerequisites: []
affectedFiles:
  plugins/task-trellis/agents/trellis-default-reviewer.md: Updated frontmatter
    description to reflect implementation-review focus. Updated opening
    paragraph to say 'review code implementations' instead of 'review code,
    issues, and plans'. Inlined full testing guidelines (unit tests, integration
    tests, performance tests, general philosophy) after Analysis Guidelines
    section. Inlined full code documentation guidelines (what to document, how
    to document, what not to do, remember section) after Testing Guidelines
    section.
log:
  - Updated trellis-default-reviewer agent to specialize for implementation
    review (code review). Changed description and opening paragraph to reflect
    implementation-review focus, removing mentions of "issues" and "plans".
    Inlined the full testing guidelines (code-evaluation version) and code
    documentation guidelines from the issue-implementation-review skill into the
    agent's system prompt. All existing content (tools list, Skill Invocation
    section, Analysis Guidelines section) preserved unchanged.
schema: v1.0
childrenIds: []
created: 2026-02-07T21:28:25.777Z
updated: 2026-02-07T21:28:25.777Z
---

## Overview

Update the existing `plugins/task-trellis/agents/trellis-default-reviewer.md` to specialize it exclusively for implementation review (code review). It is currently shared across three roles (planner, implementation reviewer, issue reviewer) and is too generic. With the new `trellis-default-issue-writer` agent handling issue review, and the planner moving to the built-in `Explore` type, the reviewer agent can now embed role-specific guidelines.

## Context

The reviewer agent currently has a generic description: "Read-only analysis agent for reviewing code, issues, and plans." After this change, it will exclusively serve the `issue-implementation-review` skill for code review.

File to modify: `plugins/task-trellis/agents/trellis-default-reviewer.md`

Guidelines to inline:
- `plugins/task-trellis/skills/issue-implementation-review/testing-guidelines.md` (code-evaluation version)
- `plugins/task-trellis/skills/issue-implementation-review/code-documentation-guidelines.md`

## Implementation Requirements

### 1. Update Description in Frontmatter

Change the `description` field from:
```
Read-only analysis agent for reviewing code, issues, and plans. Used by Trellis orchestration skills for code review, issue verification, and implementation planning.
```
To reflect its implementation-review focus. Something like:
```
Read-only analysis agent for reviewing code implementations. Used by Trellis orchestration skills for code review of completed task implementations.
```

### 2. Keep Tools Unchanged

Do NOT modify the tools list. It stays exactly as-is:
```yaml
tools:
  - Skill
  - Read
  - Glob
  - Grep
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__list_issues
  - mcp__perplexity-ask__perplexity_ask
```

### 3. Keep Existing System Prompt Content

Keep ALL of the following unchanged:
- Opening paragraph ("You are a read-only analysis agent...")
- Skill Invocation section (Skill Invocation Mandate + Error Abort Mandate)
- Analysis Guidelines section (Evidence-Based Analysis, Actionable Output, Concise Structured Reporting, Read-Only Constraint)

Update the opening paragraph to reflect the implementation-review focus (e.g., "Your job is to review code implementations" rather than "review code, issues, and plans").

### 4. Add Testing Guidelines Section

After the existing Analysis Guidelines section, add a new section with the FULL content of `plugins/task-trellis/skills/issue-implementation-review/testing-guidelines.md`. This is the code-evaluation version (uses "write" language, not "create tasks" language). Inline the full content:

```
## Testing Guidelines

**General Philosophy**: Tests should be purposeful and minimal. Every test must justify its existence. Prefer fewer, well-designed tests over exhaustive coverage.

## Unit Tests

- Write unit tests **only** for logic that has meaningful complexity or risk of regression
- Do NOT test trivial code (simple getters/setters, pass-through methods, basic logging, straightforward CRUD operations)
- A single well-crafted test that covers the important behavior is better than ten tests covering every permutation
- Ask: "What bug would this test actually catch?" If the answer is unclear, skip the test

## Integration Tests

Only write integration tests when **ALL** of these apply:

1. The interaction between components has non-trivial logic or failure modes
2. A bug in this integration would be difficult to catch with unit tests alone
3. The integration is critical to core functionality

Do NOT write integration tests simply because two components communicate.

Integration tests must execute in under 500ms. If they can't, reconsider whether the test is necessary or if it can be restructured.

## Performance Tests

**Never** write performance tests unless explicitly requested by the user. This is not a default part of any feature implementation.

## When in Doubt

Err on the side of fewer tests. Undertesting is easier to fix than maintaining a bloated test suite.
```

### 5. Add Code Documentation Guidelines Section

After the Testing Guidelines section, add a new section with the FULL content of `plugins/task-trellis/skills/issue-implementation-review/code-documentation-guidelines.md`. Inline the full content (it's a substantial document covering: What to Document, How to Document, What NOT to Do, and the Remember section about AI agents reading documentation).

## Acceptance Criteria

1. `description` in frontmatter reflects implementation-review focus (no mention of "issues", "plans", or "planning")
2. Tools list is UNCHANGED (same 7 tools)
3. Opening paragraph updated to reflect implementation-review focus
4. Skill Invocation section is unchanged
5. Analysis Guidelines section is unchanged
6. Testing guidelines (code-evaluation version) are fully inlined after Analysis Guidelines
7. Code documentation guidelines are fully inlined after Testing Guidelines
8. No `model`, `permissionMode`, or `skills` added to frontmatter
9. `Skill` tool remains in the tools list

## Out of Scope

- Updating any skills to reference this agent differently (handled by a separate task)
- Creating the new `trellis-default-issue-writer` agent (handled by a separate task)
- Deleting any guideline files