# Discovery Playbook: General

Fallback for questions that don't fit any other discovery type.

## Process

1. **Frame the question** — clarify what's being asked and what a useful answer looks like.
2. **Gather** — use any available information-gathering tool (Perplexity, Gemini, context7, WebSearch/WebFetch), `Read`, `Glob`, `Grep`, or `Task` as appropriate.
3. **Synthesize** — distill findings into a clear, actionable answer.

## Output

Keep it tight. Cite sources inline (URLs or `path/to/file:line`). Omit any section with nothing real to say — empty headings are noise.

```
## Findings
[Evidence and observations, with citations inline.]

## Recommendation
[1–3 sentences: suggested next steps or the answer.]

## Open questions
[Unresolved decisions. Omit entirely if none.]

## Bottom line
[One or two sentences the reader should walk away with.]
```
