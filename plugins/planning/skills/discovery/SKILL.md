---
name: discovery
description: Use when asked to "investigate", "analyze", "what would be involved", "scope this work", "research", "discover", "look into", "audit docs", or "research [tool/library]". Self-classifies the discovery type and dispatches to a playbook. Callers must not pass a subtype.
allowed-tools:
  - Task
  - Glob
  - Grep
  - Read
  - WebFetch
  - WebSearch
  - AskUserQuestion
---

# Discovery

Read the request, classify it into one of five types, load the matching playbook via `Read`, and follow it verbatim. Callers never pass a subtype — the router decides.

## Required Inputs

- **Question or request**: What to investigate, analyze, or research.

Callers MUST NOT pre-classify or pass a subtype hint.

## Discovery Types

- **technical-code** — understanding a proposed codebase change: affected files, call chains, change points, risks.
- **agentic-dev** — changes to Claude Code surfaces: skills, hooks, agents, plugins, MCP wiring, frontmatter.
- **tool-research** — web-grounded investigation of an external library, tool, API, or technology.
- **documentation** — auditing existing docs for drift, missing surfaces, or stale references.
- **general** — anything that doesn't fit the above.

## Process

1. Read the request and pick the best-matching type from the list above.
2. If two types are genuinely ambiguous, ask one clarifying question via `AskUserQuestion` before proceeding. Otherwise self-classify and proceed.
3. `Read` `${CLAUDE_SKILL_DIR}/playbooks/<type>.md` (substituting the chosen type) and follow its instructions verbatim.
4. Note the chosen type at the start of the response if it would be useful to the caller.

## Information-Gathering Note

Where a playbook directs you to do external research, use any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch).
