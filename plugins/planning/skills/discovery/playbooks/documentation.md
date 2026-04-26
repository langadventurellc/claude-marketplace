# Discovery Playbook: Documentation

Audit existing documentation for drift between docs and code, missing surfaces, and stale references.

## Process

1. **Inventory the docs surface** — `Glob` for `README*`, `CLAUDE.md`, `AGENTS.md`, `docs/**`, and plugin-level docs. `Read` each file.
2. **Map docs to code** — for each doc claim, use `Glob`/`Grep` to verify the corresponding code exists and matches.
3. **Find missing surfaces** — identify code paths, exported APIs, skills, hooks, or agents that docs don't mention but should.
4. **Flag stale references** — find links, file paths, tool names, or commands that no longer match reality.
5. **Verify external references** — when docs link to external URLs or reference external tools, use any available information-gathering tool (Perplexity, Gemini, context7, WebSearch/WebFetch) to confirm they are current — only when relevant.

## Output

Keep it tight. Each table has its own Fix column, so don't repeat fixes elsewhere. Omit any section with nothing real to say — empty headings are noise.

```
## Drift
| Doc file:line | Claim | Reality | Fix |
|---|---|---|---|

## Missing surfaces
| Code path | Doc that should mention it | Fix |
|---|---|---|

## Stale references
| Doc file:line | Dead reference | Fix |
|---|---|---|

## Recommendation
[1–3 sentences: which fixes to do first and why. If everything is equal-priority, say so.]

## Open questions
[Doc decisions still needed. Omit entirely if none.]

## Bottom line
[One or two sentences: how bad is the drift, what's the headline.]
```
