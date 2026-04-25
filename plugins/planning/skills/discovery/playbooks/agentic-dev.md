# Discovery Playbook: Agentic Dev

Investigate a proposed change to Claude Code surfaces: skills, hooks, agents, plugins, MCP wiring, frontmatter, or marketplace entries.

## Process

1. **Fetch current docs first** — before inspecting any code, use `WebFetch` to load the relevant Claude Code documentation:
   - https://code.claude.com/docs/en/plugins
   - https://code.claude.com/docs/en/plugins-reference
   - https://code.claude.com/docs/en/plugin-marketplaces
   - https://code.claude.com/docs/en/skills
   - https://code.claude.com/docs/en/hooks
   - https://code.claude.com/docs/en/sub-agents

   Fetch the pages relevant to the surfaces in scope. Record the doc citations — they are required in the output.

2. **Inspect affected files** — use `Glob`, `Grep`, and `Read` to examine `plugin.json`, `marketplace.json`, `SKILL.md`, `hooks.json`, agent `.md` files, `.mcp.json`, `.lsp.json`. Note the MCP tool-naming convention: `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`.

3. **Research additional context** — for anything not covered by the Claude Code docs, use any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch).

4. **Identify what changes** — for each affected surface, state which file changes, what field or section changes, and cite the doc that defines the constraint.

## Output

```
## Agentic Dev Discovery: [Title]

### Summary
[2–3 sentences on what the change touches and key constraints]

### Affected Surfaces
| File path | Surface type | What changes | Doc citation |
|---|---|---|---|

### Doc Citations
[URLs fetched, with one-line summary of what each confirmed]

### Risks
[Frontmatter constraints, lifecycle quirks, tool-naming pitfalls, breaking changes]

### Recommendations
[How to make the change; preferred approach with rationale]

### Files Reviewed
[Bulleted list of files examined]
```
