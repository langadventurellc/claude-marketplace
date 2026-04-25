# Discovery Playbook: Documentation

Audit existing documentation for drift between docs and code, missing surfaces, and stale references.

## Process

1. **Inventory the docs surface** — `Glob` for `README*`, `CLAUDE.md`, `AGENTS.md`, `docs/**`, and plugin-level docs. `Read` each file.
2. **Map docs to code** — for each doc claim, use `Glob`/`Grep` to verify the corresponding code exists and matches.
3. **Find missing surfaces** — identify code paths, exported APIs, skills, hooks, or agents that docs don't mention but should.
4. **Flag stale references** — find links, file paths, tool names, or commands that no longer match reality.
5. **Research external references** — when docs link to external URLs or reference external tools, use any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch) to verify they are current (only when relevant).

## Output

```
## Documentation Audit: [Scope]

### Drift
| Doc file:line | Claim | Reality | Fix |
|---|---|---|---|

### Missing Surfaces
| Code path | Doc that should mention it | Fix |
|---|---|---|

### Stale References
| Doc file:line | Dead reference | Fix |
|---|---|---|

### Files Reviewed
[Bulleted list of docs and code files examined]
```
