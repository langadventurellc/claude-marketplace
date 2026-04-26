# Discovery Playbook: Technical Code

Investigate a proposed codebase change. Produce a tight report; do not implement.

## Process

1. **Find** — `Glob`/`Grep` the code related to the question. For wide searches across an unfamiliar codebase, delegate via `Task` with `subagent_type="Explore"`.
2. **Read** — open key files; trace imports/calls only as far as needed to answer.
3. **Check tests** — confirm expected behavior where it matters.
4. **Research externals** — when libraries or APIs are involved, use any available information-gathering tool (Perplexity, Gemini, context7, WebSearch/WebFetch).
5. **Recommend** — pick the best approach.

## Output

Keep it tight. Cite inline (`path/to/file:42` or `(per https://...)`). Omit any section with nothing real to say — empty headings are noise.

```
## Change points
- `path/to/file:line` — what changes here

## Risks
[Real edge cases, dependency surprises, behavior changes, test gaps. Omit entirely if none.]

## Recommendation
[1–3 sentences: the approach and the tradeoff that matters. Cite files/URLs inline.]

## Open questions
[Decisions that block progress. Omit entirely if none.]

## Bottom line
[One or two sentences the reader should walk away with.]
```
