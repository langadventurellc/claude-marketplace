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

## Asking the User During Research

When research surfaces an ambiguity that would materially change your recommendation, ask the user via `AskUserQuestion` before finalizing the output. Group related questions into one focused round — don't drip them out.

Ask when:
- The approach hinges on a user preference you don't know
- Scope could plausibly be much larger or much smaller than assumed
- A constraint you discovered (in code or docs) would change the recommendation if it applies

Don't ask when:
- It's minor enough to leave as an "Open question" in the output
- You can answer it yourself with more reading or one more doc fetch
- It's a stylistic preference rather than a load-bearing decision

This is a single focused round, not a conversation. If the request is vague enough to need extended back-and-forth, that's `requirements-creation`'s job, not this one. Open questions in the final output should be the *less critical* unknowns; the load-bearing ones get asked.

## Information-Gathering Note

Where a playbook directs you to do external research, use any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch).
