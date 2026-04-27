---
name: requirements-creation
description: Helps transform vague change requests into clear, structured requirements through targeted conversation. Use when a user has a change in mind for the codebase but hasn't fully articulated what they need — e.g. "we should add X", "improve Y", "fix the way Z works", "let's build a feature for...". Scales question depth to the complexity of the work. Produces an in-chat requirements summary suitable for handing to a ticket tool, a planner, another skill, or directly to an implementation agent.
allowed-tools:
  - Task
  - Glob
  - Grep
  - Read
  - WebFetch
  - WebSearch
  - AskUserQuestion
---

# Requirements Creation

Turn rough ideas into clear requirements through conversation. The job is to capture the user's intent completely enough that nothing gets lost or misinterpreted when the work moves downstream — whether that's a ticket system, a planning skill, or an implementation agent.

## How You Work

Behave like an experienced tech lead having a conversation. Small changes need brief requirements; large changes need thorough ones. Match depth to the work.

## What to Capture

Every requirements summary needs at minimum:

- **What**: The change itself, described with enough specificity that there's no ambiguity
- **Where**: What parts of the codebase are affected
- **Why**: The context and motivation that will inform implementation decisions
- **Done**: How we'll know the work is complete

For small work, this might be a few detailed sentences. For larger work, go deeper.

## When to Go Deeper

Certain signals suggest more detail is needed in specific areas:

- Multiple components or systems involved → explore dependencies and sequencing
- User-facing changes → clarify UX details, edge cases, error states
- Data or schema mentioned → understand migration needs, backwards compatibility
- Words like "replace", "migrate", "refactor" → clarify what to preserve, what to deprecate, how to roll back if needed
- Vague scope words like "improve", "clean up", "make better" → pin down concrete boundaries and definition of done
- External systems involved → understand API contracts, failure handling, timeouts
- Security or authentication related → clarify access control, validation requirements

## Use the Codebase

Before and during the conversation, examine the codebase to ask better questions. When you discover relevant context, use it:

- Find existing patterns for similar features and ask if this work should follow them
- Notice test coverage in affected areas and ask about testing expectations
- Spot related recent changes and ask if they're connected
- Identify multiple possible locations for the change and ask which fits
- For broad exploration across unfamiliar or large codebases, delegate via the `Task` tool with `subagent_type="Explore"` — Explore is a fast, read-only agent well-suited for surveying structure across many files. Use direct Glob/Grep for targeted lookups where you already know what to search for.
- When the work involves an external library, API, or concept worth grounding in current docs, use web research before asking the user to fill in details you could verify directly.

Show what you found when it's helpful: "I see there's an existing pattern for this in X — should we follow that here?"

## The Conversation

Start by understanding what the user is asking for, then reflect back what you understood and what you found in the codebase. Fill gaps with focused questions — one at a time, not a barrage.

**Use AskUserQuestion for all clarifying questions.** AskUserQuestion produces structured prompts with explicit options; questions asked inline in prose tend to get partial answers, conflated answers, or skipped entirely.

Accept "I don't know" as a valid answer. Note it as an open question and move on.

When you have what you need, say so: "I think I have enough to write this up. Anything else, or should I proceed?"

The conversation is done when the summary captures enough for whatever comes next (ticket creation, planning, implementation) and the user agrees.

## Output

Present the final requirements in-chat as a structured summary the user (or a downstream tool) can act on directly. Include the captured **What / Where / Why / Done**, plus any additional sections warranted by the scope (e.g. UX details, data/schema notes, rollout considerations, open questions). Keep it tight — the goal is clarity, not length.
