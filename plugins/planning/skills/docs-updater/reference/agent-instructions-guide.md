# Authoring CLAUDE.md and AGENTS.md

`CLAUDE.md` (Claude Code) and `AGENTS.md` (cross-agent convention used by Cursor, Aider, and others) are steering specs for AI coding agents. They are not README replacements and not code indexes. The goal: "the minimum instructions an agent always needs, and nothing else."

If both files exist in a project, treat them as peers — they should convey the same core guidance, possibly with small wording differences. Do not let them drift apart.

## Core principles

- **Short**: aim for ≤150 lines. An agent reads the full file every session; every line costs context.
- **Actionable**: commands, rules, gotchas. Avoid prose that doesn't change agent behavior.
- **Don't mirror the README**: link to it.
- **Don't list files**: link to deeper docs instead.
- **Mental model**: "If this file disappeared, what would cause the agent to start making bad choices?" That's what belongs here.

## Recommended structure

1. **Project overview** — 1-3 sentences. What the app is, primary tech stack, key constraints.
2. **How to run, build, and test** — explicit commands in code blocks, including non-obvious flags.
3. **Conventions and boundaries** — code style not enforced by tooling, folder layout, naming patterns, architectural rules. Include "Always / Ask first / Never" lists for risky operations (DB schema, auth, infra, secrets, CI).
4. **Task workflow for agents** — branching/commit style, PR expectations, whether to run tests/linters before proposing changes.
5. **Links to deeper docs** — point to README, `docs/`, ADRs, or external URLs rather than duplicating content.

## What to remove

- Raw listings of files or directories beyond high-level structure.
- Verbatim agent output (summaries, long path lists from scans).
- Obvious advice ("write clean code", "add comments when appropriate").
- Content already in the README — link instead.

## What to keep (but compress)

- A very short "Project structure" section, only for key folders and special patterns.
- Non-obvious layering rules (e.g., "components may import hooks, but hooks must not import components").

## What to push elsewhere

- Detailed API docs, schema docs, ADRs, design notes → put in `docs/` and link.
- Domain tutorials or user guides → README or `docs/`.

## Patterns that work well

- **Progressive disclosure**: the root file is minimal; deeper topics live in separate files linked from the root.
- **Clear precedence**: for monorepos, use nested `CLAUDE.md` / `AGENTS.md` files where "closest file wins" for local instructions.
- **Explicit guardrails beat vague cautions**: "Ask before adding new runtime dependencies" beats "be careful with dependencies"; "Never edit GitHub Actions workflows without approval" beats "be mindful of CI".

## When editing

- Make the smallest change that fixes the staleness.
- Preserve existing headings and section order.
- If the file is already well over 150 lines, avoid adding length — consider suggesting that a section move to `docs/`.
- If `CLAUDE.md` and `AGENTS.md` both exist and currently diverge, flag that in the summary rather than silently rewriting one to match the other.
