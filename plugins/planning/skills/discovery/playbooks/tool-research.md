# Discovery Playbook: Tool Research

Investigate an external library, tool, API, or technology in the context of the user's concern.

## Process

1. **Frame the concern** — minimal `Read`/`Grep` to confirm stack and version (e.g. `package.json`, `pyproject.toml`).
2. **Research** — use any available information-gathering tool (Perplexity, Gemini, context7, WebSearch/WebFetch) for version-current usage patterns, official docs, and known sharp edges.
3. **Synthesize** — map findings to the user's specific concern.

## Output

Keep it tight. Cite sources inline (`(per https://...)`). Omit any section with nothing real to say — empty headings are noise.

```
## What it is
[One short paragraph — purpose of the tool, only as much as the reader needs.]

## Version-current usage
[Concrete usage patterns relevant to the user's concern, with citations inline.]

## Sharp edges
[Known gotchas, breaking changes, version-specific caveats. Cite inline. Omit entirely if none.]

## Recommendation
[1–3 sentences: how to apply this to the user's question.]

## Open questions
[What's still unclear or version-dependent. Omit entirely if none.]

## Bottom line
[One or two sentences the reader should walk away with.]
```
