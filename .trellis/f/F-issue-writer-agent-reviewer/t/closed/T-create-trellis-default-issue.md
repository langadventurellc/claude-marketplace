---
id: T-create-trellis-default-issue
title: Create trellis-default-issue-writer agent
status: done
priority: high
parent: F-issue-writer-agent-reviewer
prerequisites: []
affectedFiles:
  plugins/task-trellis/agents/trellis-default-issue-writer.md:
    Created new agent file with YAML frontmatter (name, description, 7 tools)
    and system prompt containing Skill Invocation Mandate, Error Abort Mandate,
    Issue Writing Guidelines, and Testing Guidelines
log:
  - Created the trellis-default-issue-writer agent file with YAML frontmatter
    containing the 7 shared tools (Skill, Read, Glob, Grep, get_issue,
    list_issues, perplexity_ask), and a system prompt that includes the Skill
    Invocation Mandate, Error Abort Mandate, Issue Writing Guidelines (adapted
    from trellis-default-author), and the full testing guidelines (issue-scoping
    version) inlined from issue-creation/testing-guidelines.md.
schema: v1.0
childrenIds: []
created: 2026-02-07T21:28:03.804Z
updated: 2026-02-07T21:28:03.804Z
---

## Overview

Create a new agent file `plugins/task-trellis/agents/trellis-default-issue-writer.md` for writing and reviewing Trellis issues. This agent will be used by both the `issue-creation` and `issue-creation-review` skills.

## Context

The current system uses `trellis-default-author` for issue creation and `trellis-default-reviewer` for issue review. This task creates a new specialized agent that combines the needs of both roles with a focused toolset. The design principle is that agents define HOW to work (standards, guidelines) while skills define WHAT workflow to follow — they are orthogonal.

Reference the existing agents for format conventions:
- `plugins/task-trellis/agents/trellis-default-author.md` — adapt authoring guidelines from here
- `plugins/task-trellis/agents/trellis-default-reviewer.md` — follow the same structural patterns
- `plugins/task-trellis/agents/trellis-default-developer.md` — follow the same structural patterns

## Implementation Requirements

### YAML Frontmatter

```yaml
---
name: trellis-default-issue-writer
description: Issue writing agent for creating and reviewing Trellis issues. Used by Trellis orchestration skills for issue creation and issue verification.
tools:
  - Skill
  - Read
  - Glob
  - Grep
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__list_issues
  - mcp__perplexity-ask__perplexity_ask
---
```

**CRITICAL**: The tools list must be ONLY the shared subset needed by both `issue-creation` and `issue-creation-review` skills. Do NOT include `Task`, `AskUserQuestion`, `create_issue`, `update_issue`, `Write`, `Edit`, `Bash`, `WebFetch`, `WebSearch`, `LS`, `TodoWrite`, or any other tool. Those tools come from the skills' `allowed-tools`, not the agent.

Do NOT include `model`, `permissionMode`, or `skills` in the frontmatter.

### System Prompt Content

The markdown body after the frontmatter must include these sections:

#### 1. Skill Invocation Mandate + Error Abort Mandate
Copy the exact pattern from the existing agents (e.g., `trellis-default-reviewer.md` lines 17-25):
```
## Skill Invocation

MANDATORY FIRST ACTION: Your very first action MUST be to use the Skill tool to invoke
the skill specified in your task prompt. Do NOT read files, do NOT search code, do NOT
analyze anything, do NOT take ANY other action before invoking this skill. The skill
contains your complete workflow and instructions.

If you encounter ANY errors invoking the skill (permission denied, skill not found, tool
not available, or any other error), STOP IMMEDIATELY and report the exact error back. Do
NOT attempt workarounds. Do NOT try to perform the task without the skill.
```

#### 2. Issue Writing Guidelines
Adapt from `trellis-default-author.md`'s Authoring Guidelines (lines 34-56), reworded for issue writing context:
- **Research-First Approach**: Always search the codebase before creating or reviewing anything
- **Codebase as Source of Truth**: Parent issues may be outdated; when conflicts exist, codebase wins
- **Concise Writing**: KISS/YAGNI principles, write only what is needed, bullet points over prose

#### 3. Testing Guidelines (Issue-Scoping Version)
Inline the FULL content of `plugins/task-trellis/skills/issue-creation/testing-guidelines.md`. This is the version focused on *planning/scoping* tests (uses "create tasks" language, not "write tests" language). Copy it verbatim — do not reference the file, inline it entirely.

The content to inline:
```
# Testing Guidelines

**General Philosophy**: Tests should be purposeful and minimal. Every test must justify its existence. Prefer fewer, well-designed tests over exhaustive coverage.

## Unit Tests

- Write unit tests **only** for logic that has meaningful complexity or risk of regression
- Do NOT create tests for trivial code (simple getters/setters, pass-through methods, basic logging, straightforward CRUD operations)
- A single well-crafted test that covers the important behavior is better than ten tests covering every permutation
- Ask: "What bug would this test actually catch?" If the answer is unclear, skip the test
- **Include unit tests in the same task** as the production code changes—do not create separate "write unit tests" tasks

## Integration Tests

Integration tests are expensive. Only create separate integration test tasks when **ALL** of these apply:

1. The interaction between components has non-trivial logic or failure modes
2. A bug in this integration would be difficult to catch with unit tests alone
3. The integration is critical to core functionality

Do NOT create integration tests simply because two components communicate.

Integration tests must execute in under 500ms. If they can't, reconsider whether the test is necessary or if it can be restructured.

## Performance Tests

**Never** create performance test tasks unless explicitly requested by the user. This is not a default part of any feature implementation.

## When in Doubt

Err on the side of fewer tests. Undertesting is easier to fix than maintaining a bloated test suite.
```

## Acceptance Criteria

1. File `plugins/task-trellis/agents/trellis-default-issue-writer.md` exists
2. YAML frontmatter has `name: trellis-default-issue-writer`, `description`, and exactly the 7 tools listed above
3. No `model`, `permissionMode`, or `skills` in frontmatter
4. System prompt includes Skill Invocation Mandate and Error Abort Mandate (verbatim pattern from other agents)
5. System prompt includes issue writing guidelines (research-first, codebase as source of truth, concise writing)
6. System prompt includes the full testing guidelines (issue-scoping version) inlined, not referenced
7. `Skill` tool is in the tools list

## Out of Scope

- Updating any skills to reference this agent (handled by a separate task)
- Modifying any existing agents
- Deleting any guideline files