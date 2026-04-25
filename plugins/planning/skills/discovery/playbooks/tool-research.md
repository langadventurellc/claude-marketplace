# Discovery Playbook: Tool Research

Investigate an external library, tool, API, or technology in the context of the user's concern.

## Process

1. **Frame the concern** — do a minimal `Read`/`Grep` to understand the stack and version context (e.g. check `package.json`, `pyproject.toml`, or equivalent).
2. **Research** — use any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch) to find version-current usage patterns, official docs, and known sharp edges. Cite every URL.
3. **Synthesize** — map findings to the user's specific concern. Flag anything version-specific or likely to change.

## Output

```
## Tool Research: [Tool Name]

### What It Is
[One-paragraph description of the tool and its purpose]

### Relevance to [User's Concern]
[How the tool applies to the specific question asked]

### Version-Current Usage
[How to use it today, with cited sources]

### Sharp Edges
[Known gotchas, breaking changes, or version-specific caveats — with citations]

### Sources
[All URLs consulted]
```
