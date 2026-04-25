# Discovery Playbook: Technical Code

Investigate a proposed codebase change or technical question. Produce a structured report without implementing anything.

## Process

1. **Parse the request** — identify the core question, scope boundaries, and what a useful answer looks like.
2. **Find affected files** — use `Glob` and `Grep` to locate code related to the problem. For wide-ranging searches across unfamiliar codebases, delegate via the `Task` tool with `subagent_type="Explore"`.
3. **Read key files** — understand current implementations, patterns, and conventions.
4. **Trace dependencies** — follow imports and call chains to understand relationships.
5. **Check tests** — review existing tests to understand expected behavior.
6. **Identify change points** — where would modifications actually occur?
7. **Research external context** — when the problem involves libraries or APIs outside the codebase, use any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch) for up-to-date docs or known issues.
8. **Formulate recommendations** — viable approaches with tradeoffs; flag open questions.

## Output

```
## Technical Discovery: [Brief Title]

### Summary
[2–3 sentence overview of findings and key takeaway]

### Problem Understanding
[Restate the question as understood, including scope assumptions]

### Findings

#### Codebase Analysis
- **Relevant Files**: [Key files with brief descriptions]
- **Current Patterns**: [How the codebase handles similar concerns today]
- **Change Points**: [Where modifications would occur]

#### External Research
[Findings from web research — omit if not applicable]

### Impact Assessment
- **Components Affected**: [What parts of the system would be touched]
- **Dependencies**: [What depends on affected areas]
- **Risks**: [Potential issues, edge cases, concerns]

### Recommendations
[Suggested approaches with tradeoffs]

### Open Questions
[Decisions still needed — omit if none]

### Files Reviewed
[Bulleted list of files examined]
```
