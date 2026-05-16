# Authoring CLAUDE.md and AGENTS.md

`CLAUDE.md` (Claude Code) and `AGENTS.md` (open standard at https://agents.md, stewarded by the Agentic AI Foundation) are steering specs for AI coding agents. They are not README replacements and not code indexes. The goal: "the minimum instructions an agent always needs, and nothing else."

## Core principles

- **Short**: see length budgets below. The agent re-reads these every session; every line costs context.
- **Actionable**: commands, rules, gotchas. Avoid prose that doesn't change agent behavior.
- **Don't mirror the README**: link to it.
- **Don't list files**: link to deeper docs.
- **Mental model**: "If this file disappeared, what would cause the agent to start making bad choices?" That's what belongs here.

## Length budgets

| Scope | Target | Hard ceiling |
|---|---|---|
| Project `CLAUDE.md` | 30–60 lines | ~200 lines |
| User `~/.claude/CLAUDE.md` | One screenful | Keep lean so project rules override cleanly |
| Root `AGENTS.md` | 100–150 lines | ~300 if heavily structured |
| Subdirectory `CLAUDE.md` / `AGENTS.md` | Shorter than root, sized to local needs | Same concision principle |
| Path-scoped `.claude/rules/<name>.md` | Tight — one topic | Split if it grows |

**Why budgets matter.** Frontier models reliably follow ~150–200 atomic instructions before *global* adherence decays. Past that ceiling, adding more rules makes the agent follow *fewer* rules. Some tools also truncate silently at hard byte limits (e.g., GitHub Copilot CLI / Codex at 32 KiB).

## Recommended structure

1. **Project overview** — 1–3 sentences. What the app is, primary tech stack, key constraints.
2. **How to run, build, and test** — explicit commands in code blocks, including non-obvious flags.
3. **Conventions and boundaries** — code style not enforced by tooling, folder layout, naming patterns, architectural rules. Include "Always / Ask first / Never" lists for risky operations (DB schema, auth, infra, secrets, CI).
4. **Task workflow for agents** — branching/commit style, PR expectations, whether to run tests/linters before proposing changes.
5. **Links to deeper docs** — point to README, `docs/`, ADRs, or external URLs rather than duplicating content.

## Voice

Imperative, command-first, one constraint per sentence. Pair condition + required action.

- Bad: "Tests should be run regularly."
- Good: "Before merging, run `pnpm test` from the package root and ensure all tests pass."

Use `IMPORTANT` or `YOU MUST` markers sparingly for the rules that matter most — they help the model survive attention competition. Avoid idioms; predictable, repeated phrasing matters more than literary variety.

## Hierarchy and precedence

Both files support nesting. The semantics differ.

**`AGENTS.md` — "nearest file wins"** (per https://agents.md). When the agent works on a file, tools walk up from that file's directory; the closest `AGENTS.md` takes precedence for its subtree. Codex supports an optional `AGENTS.override.md` that *replaces* rather than extends inherited rules — useful for vendor dirs.

**`CLAUDE.md` — concatenation with ordering** (per https://code.claude.com/docs/en/memory). At session start, Claude walks cwd up to the filesystem root and concatenates every `CLAUDE.md` / `CLAUDE.local.md` it finds. Root-most appears first; nearest appears last; later-in-prompt wins effective attention — but root rules are still in context and still influence the agent. Subdirectory `CLAUDE.md` files *below* cwd load on demand when Claude reads or edits files in that subtree, which is the explicit mechanism for keeping monorepo context small.

`.claude/rules/*.md` is Claude Code's path-scoped tier. With `paths:` frontmatter (e.g., `paths: src/api/**/*.ts`), the rule loads only when matching files are touched. Use it when the rule is tied to a file pattern rather than a directory.

## Splitting heuristics — what goes where

| Guidance | Belongs in |
|---|---|
| Project overview, repo-wide commands, branch/commit conventions, security baselines, deep-doc pointers | Root `CLAUDE.md` / `AGENTS.md` |
| Per-package framework, language-specific tooling, design-system rules for one app, legacy quirks of one service | Subdirectory `CLAUDE.md` / `AGENTS.md` |
| Rule that applies to files matching a glob across the repo | `.claude/rules/<name>.md` with `paths:` frontmatter |
| Long procedures (schema migrations, release process, on-call runbooks) | `docs/<topic>.md`, with a one-line pointer from the instruction file |
| API reference, schema docs, design notes | `docs/`, never inlined |

**Litmus tests:**

- **Scope**: whole repo or one subtree?
- **Frequency**: would most sessions hitting this area need this rule? If only a minority would, push deeper.
- **Deducibility**: can the agent infer it from code or config? If yes, omit entirely.

## CLAUDE.md ↔ AGENTS.md when both exist

Claude Code does **not** natively read `AGENTS.md`. Three integration patterns, in order of preference:

1. **Symlink** — `ln -s AGENTS.md CLAUDE.md`. Claude reads `AGENTS.md` as if it were `CLAUDE.md`. Anthropic's own memory docs show this example. Edits to either name modify one file; drift is impossible.
2. **Stub-and-reference** — `CLAUDE.md` is one line: `See @AGENTS.md` (using Claude's `@file` import syntax), plus any Claude-only additions (compaction prefs, subagent hints).
3. **Two peer files kept in sync** — common but drift-prone (the "copy-paste agent" anti-pattern). Treat them as peers; updates to one usually need mirroring in the other. If they currently diverge, flag that rather than silently rewriting one to match.

If only one file exists, the project picked a side. Don't create the missing peer unless explicitly asked.

## When editing

- Make the smallest change that fixes the staleness.
- Preserve existing headings and section order.
- If the file is already over its length budget, push new content to a nested file, a path-scoped rule, or a referenced doc rather than appending.
- If `CLAUDE.md` and `AGENTS.md` both exist and currently diverge, flag that in the summary rather than silently rewriting one to match the other.
- If `CLAUDE.md` is a symlink, edit the link target (the real file), not the link name.

## When creating

- New subdirectory `CLAUDE.md` / `AGENTS.md` is correct when guidance is genuinely subtree-local and would otherwise bloat the root file. Keep it focused on its subtree; do not duplicate root guidance.
- New `.claude/rules/<name>.md` is correct when guidance is tied to a file pattern (set `paths:` frontmatter) rather than a directory.
- Match the repo's filename and directory conventions. If the repo has no `docs/`, don't create one; if it uses `SCREAMING_SNAKE.md`, don't introduce `kebab-case.md`.

## Anti-patterns

- **README clones** — duplicating project narrative wastes tokens and biases agents to outdated examples.
- **Directory listings and large code dumps** — pushes agents to pattern-match on stale snippets instead of the live code.
- **Vague rules** — "be careful", "write clean code" — correlate with poor adherence. Use concrete commands with done-criteria.
- **Conflicting rules across sections** — agents oscillate. Resolve with priority numbering or path scoping.
- **Cross-file drift** — maintaining near-duplicate instructions in `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `GEMINI.md`, etc. Pick one source of truth and reference it from the others.
- **Secrets in instruction files** — API keys, DB passwords, private IPs, PII. Document where secrets live and how to access them instead.
- **Reacting to every code change** — only pattern-level changes (new framework, new build step, new mandatory check, new cross-cutting policy) warrant an instruction-file update. Per-instance facts belong in code.
