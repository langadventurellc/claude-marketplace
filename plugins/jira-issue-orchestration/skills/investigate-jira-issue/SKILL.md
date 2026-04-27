---
name: investigate-jira-issue
description: Investigate a Jira issue and turn it into a requirements or discovery document ready for implementation or Trellis issue creation. Use when the user asks to "investigate", "analyze", "look into", "scope", "break down", or "plan work for" a Jira ticket by key (e.g. ACME-1234). The skill fetches the ticket, pulls relevant linked context, then routes automatically to `planning:requirements-creation` (for ambiguous/underspecified tickets) or `planning:discovery` (for well-specified work needing research and analysis).
allowed-tools:
  - AskUserQuestion
  - Skill
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config
  - mcp__plugin_atlassian_atlassian__getJiraIssue
  - mcp__plugin_atlassian_atlassian__getJiraIssueRemoteIssueLinks
  - mcp__plugin_atlassian_atlassian__getConfluencePage
---

# Investigate Jira Issue

Turn a Jira ticket into an actionable design artifact — either a **requirements summary** (when the ticket is ambiguous and the user needs to be interrogated) or a **technical discovery document** (when the ticket is well-specified and the work is research/analysis). This skill is a router: it fetches the ticket, gathers relevant context, decides which downstream planning skill fits, and invokes it with the right payload.

## Input

- **Required**: a Jira issue key (e.g. `ACME-1234`).
- **Optional**: any additional user instructions to forward verbatim to the downstream planning skill (focus areas, specific files to inspect, constraints, deadlines, etc.).

Ticket URL format: `<BASE_URL>/browse/<KEY>`.

If the user didn't supply an issue key, ask for one with `AskUserQuestion` before doing anything else.

## Workflow

### 0. Preflight: load configuration

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config` with no arguments. Bind `BASE_URL` from `values.atlassianBaseUrl` and `CLOUD_ID` from `values.atlassianCloudId`.

### 1. Fetch the ticket

Call `mcp__plugin_atlassian_atlassian__getJiraIssue` with `CLOUD_ID` from step 0 and the issue key. Capture:

- Summary, description, issue type, status
- Comments (skim for material context — decisions, constraints, rejections)
- Issue links (parents, epics, blocks/blocked-by, related)
- Labels, components, fix version

If the ticket has remote links, also call `mcp__plugin_atlassian_atlassian__getJiraIssueRemoteIssueLinks` to enumerate Confluence/other links.

### 2. Evaluate linked context for relevance

**Do not blindly follow every link.** Links often survive when tickets are cloned or duplicated and frequently point at unrelated work. Before pulling a linked Confluence page or Jira issue, do a cursory relevance check:

- Does the link's title/summary clearly align with this ticket's subject?
- Is the link referenced by name in the description or comments, or is it just sitting in a links panel?
- Is it a generic team landing page, or something specifically about this work?

Fetch only the linked content that passes this sniff test. Typical pulls:

- Linked Confluence pages via `mcp__plugin_atlassian_atlassian__getConfluencePage` when the page is clearly about this ticket's subject (specs, designs, discovery docs).
- Parent/epic Jira issues via `getJiraIssue` when the ticket alone is thin and the parent framing matters.
- Blocks/blocked-by issues when the dependency is relevant to scoping the work.

Keep this pass tight — one or two rounds, not a sprawling graph crawl. If a link looks borderline, skip it and note it as an open question.

### 3. Decide the route (silently)

Pick one of the two downstream planning skills based on what you see. Do not ask the user which to use.

**Use `planning:requirements-creation` when the ticket has meaningful ambiguity that benefits from interrogating the user**, for example:

- Vague scope words: "improve", "clean up", "make better", "refactor X"
- Missing or undefined acceptance criteria
- Undefined UX / user-facing behavior on a user-facing ticket
- Unclear boundaries ("replace the old thing" without stating what to preserve)
- Multiple plausible interpretations of what's being asked
- Short descriptions that read as an idea, not a specification

**Use `planning:discovery` otherwise** — i.e. when the ticket is well-specified and the value is in research and analysis:

- Clear outcome stated; the question is *how* and *where*, not *what*
- "Investigate the feasibility of X"
- "Scope the impact of changing Y"
- A concrete change with enough detail to start mapping code, risks, and trade-offs

If both signals are present, prefer `requirements-creation` — closing ambiguity first is cheaper than discovering against a moving target.

### 4. Invoke the chosen skill

Use the `Skill` tool to invoke the chosen planning skill. Pass, in the skill arguments / context you hand it:

- The Jira key and URL.
- The ticket summary, description, issue type, and status.
- Any comments you judged material.
- Relevant excerpts (not full dumps) from linked Confluence pages or linked Jira issues, with their source URL.
- The user's additional instructions verbatim.
- A short framing line stating the goal is to produce a document that will drive implementation or Trellis issue creation.

**Exploration guidance to forward to the downstream skill:**

- **Local code examination is always in scope** for code-related tickets — the planning skill should inspect the current working directory as needed.
- **Do not instruct the downstream skill to search Confluence, Perplexity, the web, or additional Jira issues unless a concrete reason exists** (e.g., the ticket references an external library by name, the ticket itself says "see the RFC", the user's instructions ask for it). Blanket "go look everywhere" instructions waste tool budget and dilute the output.

### 5. Produce the output in-chat

The chosen planning skill emits its output in-chat. That is the deliverable — do **not** write it to a file. Show the document in the conversation as-is.

At the top of the output, add a short header line identifying:

- The Jira key and URL
- Which route was taken and a one-line justification (e.g. `Route: discovery — ticket is well-specified; value is in mapping affected code and risks`)

### 6. Hand off

After the document is produced, decide how to hand off based on your invocation context:

- **If your invocation context already specifies what to do next with the document** (e.g. you were called from an orchestrator skill, or the user's instructions chain you into another skill), proceed with those instructions immediately. Do not ask the user about the handoff — that decision has already been made.
- **Otherwise**, ask the user what to do next with a single `AskUserQuestion`. Options:
  1. **Create Trellis issues** — feed the document into `task-trellis-teams:create-trellis-issues`.
  2. **Implement now** — hand the document off directly to an implementation flow (the user's preferred agent/skill for implementation).
  3. **Stop here** — leave the document in-chat; user will take it from there.

  Make the Trellis option the first entry (`(Recommended)`) when the document is broad enough to warrant issue breakdown; make `Stop here` the recommended default for small or single-change tickets.

## Notes on behavior

- **Do not ask which route to take.** The decision is yours, made silently from the ticket content. If you're genuinely torn, default to `requirements-creation` and proceed.
- **Do not pre-confirm the fetch.** Just fetch the ticket and get going.
- **Respect overrides.** If the user's additional instructions say "just do discovery" or "just gather requirements", honor that instead of auto-deciding.
- **One ticket per invocation** unless the user asks for multiple. If multiple keys are given, fetch in parallel, but still decide the route per ticket — different tickets can route differently.
- **Be honest about gaps.** If the ticket is too thin to route sensibly even after fetching links, say so and ask the user for a one-paragraph framing before invoking a planning skill.
- **A long document is not a turn-end.** The planning skill's document is the deliverable, not a stopping point. If your invocation context specifies a next step, immediately make that next tool call — do not let the visual finality of the document trick you into stopping.

## Example

**User:** `investigate ACME-3412 and focus on the image pipeline side`

**You silently:**

1. Fetch `ACME-3412`. It says: *"Add WebP support to the image ingest pipeline. Acceptance: ingest accepts WebP, stored variants include WebP, CDN serves WebP to supporting clients."*
2. Notice a linked Confluence page titled "WebP rollout plan" — clearly relevant, fetch it. Notice a linked epic `ACME-3648` "Image Format Modernization" — relevant, pull its summary. Skip a linked "Team OKRs Q2" page — generic, not ticket-specific.
3. Decide: ticket is well-specified with clear acceptance; value is in mapping affected code and risks → route to `planning:discovery`.
4. Invoke `planning:discovery` with the ticket content, the WebP rollout page excerpt, the epic framing, and the user's focus instruction. Instruct it to examine local ingest-pipeline code; do **not** instruct it to search the web or Confluence further.
5. Output the discovery document in-chat, prefaced with:

   ```
   Jira: ACME-3412 — https://acmecorp.atlassian.net/browse/ACME-3412
   Route: discovery — ticket is well-specified; value is in mapping affected ingest code and risks.
   ```

6. If your invocation context already specifies the next step, hand off immediately. Otherwise ask: create Trellis issues, implement now, or stop here?
