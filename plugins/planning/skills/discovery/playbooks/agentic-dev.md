# Discovery Playbook: Agentic Dev

Investigate a proposed change to Claude Code surfaces: skills, hooks, agents, plugins, MCP wiring, frontmatter, or marketplace entries.

## Process

1. **Fetch current docs** — `WebFetch` only the pages relevant to the surfaces in scope:
   - https://code.claude.com/docs/en/plugins
   - https://code.claude.com/docs/en/plugins-reference
   - https://code.claude.com/docs/en/plugin-marketplaces
   - https://code.claude.com/docs/en/skills
   - https://code.claude.com/docs/en/hooks
   - https://code.claude.com/docs/en/sub-agents

2. **Inspect affected files** — `Glob`/`Grep`/`Read` the relevant `plugin.json`, `marketplace.json`, `SKILL.md`, `hooks.json`, agent `.md`, `.mcp.json`, `.lsp.json`. MCP plugin tool naming: `mcp__plugin_<plugin>_<server>__<tool>`.

3. **Decide and write up** — pick the best approach. Cite docs and files inline; do not collect them in a separate section.

## Output

Keep it tight. Cite inline (`(per https://...)` or `path/to/file:42`). Omit any section with nothing real to say — empty headings are noise.

```
## Affected surfaces
- `path/to/file` — one line on what changes

## Risks
[Frontmatter quirks, tool-naming gotchas, lifecycle order, breaking changes. Omit entirely if none.]

## Recommendation
[1–3 sentences: exactly what to change and the doc-anchored reason. Cite the constraint inline.]

## Open questions
[Decisions that block progress. Omit entirely if none.]

## Bottom line
[One or two sentences the reader should walk away with.]
```
