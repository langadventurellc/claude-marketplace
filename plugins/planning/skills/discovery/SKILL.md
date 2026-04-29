---
name: discovery
description: Use when asked to "investigate", "analyze", "what would be involved", "scope this work", "research", "discover", "look into", "audit docs", or "research [tool/library]". Self-classifies the discovery type and dispatches to a playbook. Callers must not pass a subtype.
allowed-tools:
  - Task
  - Glob
  - Grep
  - Read
  - WebFetch
  - WebSearch
  - AskUserQuestion
---

# Discovery

```!
bash "${CLAUDE_SKILL_DIR}/scripts/load-playbook.sh" "${CLAUDE_SKILL_DIR}/default-router.md"
```

## Asking the User During Research

When research surfaces an ambiguity that would materially change your recommendation, ask the user via `AskUserQuestion` before finalizing the output. Group related questions into one focused round — don't drip them out.

**Before asking, do this check.** For each candidate question, re-scan the original prompt for any sentence that names the same decision. If you find one, the question is answered — even if the phrasing is informal ("I like X", "another pair can be created", "the only time it wouldn't happen is…"). If you'd have to ignore or re-litigate something the user already said in order to ask the question, don't ask it. Bias hard toward "the user already told me" — they invoked an autonomous skill on purpose.

Ask when:

- The approach hinges on a user preference you don't know
- Scope could plausibly be much larger or much smaller than assumed
- A constraint you discovered (in code or docs) would change the recommendation if it applies

Don't ask when:

- The user's prompt already states a preference on this exact topic, even informally — quote it back in the output instead of re-asking
- It's minor enough to leave as an "Open question" in the output
- You can answer it yourself with more reading or one more doc fetch
- It's a stylistic preference rather than a load-bearing decision

This is a single focused round, not a conversation. If the request is vague enough to need extended back-and-forth, that's `requirements-creation`'s job, not this one. Open questions in the final output should be the _less critical_ unknowns; the load-bearing ones get asked.

## Information-Gathering Note

Where a playbook directs you to do external research, use any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch).
