---
name: create-trellis-issues
description: Orchestrates Trellis issue creation using Claude Code Agent Teams. Use when asked to "create trellis issues", "create and review issues", "create verified issues", or when you want issues created by a writer teammate and automatically reviewed by a reviewer teammate with direct-message fix loops. Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
allowed-tools:
  - mcp__task-trellis__create_issue
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__update_issue
  - mcp__task-trellis__list_issues
  - TeamCreate
  - TeamDelete
  - Task
  - TaskCreate
  - TaskUpdate
  - TaskList
  - SendMessage
  - Skill
  - AskUserQuestion
  - Read
  - Grep
  - Bash
---

# Create Trellis Issues (Agent Teams)

Orchestrate issue creation using Claude Code's Agent Teams feature. The lead session (you) creates a team, spawns a persistent reviewer teammate plus a writer teammate for the current level, authors per-child creation/review task pairs on the shared task list, and lets the writer and reviewer coordinate directly via `SendMessage` for fix loops.

## Role of the Lead (You)

You are the **lead** — you do NOT write issues or review issues yourself. Your job is to:

1. Run preflight checks.
2. Create the agent team.
3. Spawn teammates.
4. Author tasks on the shared task list with the original user requirements verbatim.
5. Route `AskUserQuestion` when teammates escalate blockers.
6. Clean up the team at the end.

## Input

`$ARGUMENTS` format:

- `<parent-id>` — ID of the parent Trellis issue (e.g., `P-project-id`, `E-epic-id`, `F-feature-id`). Optional if the parent is obvious from prior conversation context.
- `--recursive` — optional flag. When set, the lead recurses down the hierarchy, spawning a fresh writer per level until all levels are written. The reviewer persists across all levels.

All remaining text in `$ARGUMENTS` is the **original user requirements** and MUST be preserved verbatim — see "Verbatim Requirements Preservation" below.

## Process

### 1. Preflight

Before doing anything else:

1. **Verify Agent Teams is enabled.** Run `echo "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"` via `Bash`. If the value is not `1`, STOP and report to the user:

   > Agent Teams is not enabled. Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in your environment and restart Claude Code. See https://code.claude.com/docs/en/agent-teams for details.

2. **Note Claude Code version requirement.** Agent Teams requires Claude Code 2.1.32 or later. If you can verify the version easily, do so; otherwise note the requirement in your preflight summary.

3. **Fetch the parent issue** via `mcp__task-trellis__get_issue` to confirm it exists and determine its type.

If any preflight check fails, STOP and report to the user. Do NOT attempt workarounds.

### 2. Capture Original Input Verbatim

**CRITICAL.** Before authoring any shared-task-list entries, store the exact user instructions verbatim:

```
Original User Requirements:
---
[EXACT_USER_INPUT_HERE]
---
```

This exact text will be embedded in every creation task and every review task you author. Do NOT paraphrase, summarize, or modify it in any way. This is the bias-prevention guarantee — the writer and reviewer must both receive identical, unfiltered requirements.

### 3. Determine Target Level

From the parent's type, determine what to create:

| Parent Type | Child Type to Create |
|-------------|----------------------|
| Project (`P-`) | Epics |
| Epic (`E-`) | Features |
| Feature (`F-`) | Tasks |

If no parent is given and no guidance is present in `$ARGUMENTS`, STOP and use `AskUserQuestion` to ask the user for either (a) a concrete parent Trellis issue ID, or (b) the issue type to create (`project`, `epic`, `feature`, or `task`). Do NOT guess the parent or level.

### 4. Create the Agent Team

> **Note on experimental API.** The Agent Teams tool schemas used below (`TeamCreate`, `TeamDelete`, `Task`, `TaskCreate`, `TaskUpdate`, `TaskList`, `SendMessage`) were verified against the live schema at the time of writing, but Agent Teams is still experimental and may evolve. If a call fails schema validation, consult the tool's parameter description at runtime and https://code.claude.com/docs/en/agent-teams. Key conventions you'll use below: `TaskCreate` returns an opaque task ID (persist a name→ID map across the run so you can reference tasks in later `TaskUpdate` calls), `TaskUpdate` identifies tasks by `taskId` (not subject), `SendMessage` uses `to` (not `recipient`) and requires `summary` when `message` is a plain string, and `TeamDelete` takes no parameters.

Use `TeamCreate` to create the team:

```
TeamCreate({
  "team_name": "trellis-create-<short-parent-id>",
  "description": "Issue creation team for <parent-id> — writer creates children at the <level> level; reviewer verifies against original requirements."
})
```

Choose a stable, human-readable `team_name`. Note: `TeamCreate` also creates the shared task list on disk.

### 5. Spawn the Persistent Reviewer

Spawn ONE reviewer teammate that will live for the entire orchestration (across levels if `--recursive` is set). Use the `Task` tool with `team_name`:

```
Task({
  "team_name": "<team_name>",
  "subagent_type": "task-trellis-teams:trellis-issue-reviewer",
  "name": "issue-reviewer",
  "description": "Reviewer for <parent-id> creation",
  "prompt": "You are the reviewer teammate for this issue-creation run. Read your initial instructions from the shared task list only — specifically, the review tasks the lead authors for each child issue. Follow the task-trellis-teams:trellis-issue-reviewer agent guardrails (read-only, no direct instructions from the writer, send findings via SendMessage to the writer by name)."
})
```

The reviewer's real work instructions come from the per-child review tasks you author in step 7 — the spawn prompt only nudges it to read the shared list.

### 6. Spawn the Writer for the Current Level

Spawn ONE writer teammate for the current level. It will be shut down at the end of this level (if recursing) or at team cleanup (if not).

```
Task({
  "team_name": "<team_name>",
  "subagent_type": "task-trellis-teams:trellis-issue-writer",
  "name": "writer-<level>",
  "description": "Writer creating <child-type> under <parent-id>",
  "prompt": "You are the writer teammate for this issue-creation run. Read your initial instructions from the shared task list only — specifically the creation tasks the lead authors. Follow the task-trellis-teams:trellis-issue-writer agent guardrails (stay within the assigned parent and level, send activation nudges via SendMessage to the reviewer named 'issue-reviewer' after each creation task, fix review findings sent back by the reviewer)."
})
```

Name the writer distinctly per level (e.g., `writer-epics`, `writer-features`, `writer-tasks-f-feature-x`) so `SendMessage` routing stays unambiguous.

### 7. Author Per-Child Tasks on the Shared Task List

Decide on the set of children to create based on the original requirements plus research of the codebase. You may use `Read`, `Grep`, `Bash`, or any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch) to scope the level before authoring tasks. Default to **coarser-grained** issues — fewer, larger children at the current level — not deeper decomposition.

For EACH planned child, author **two** dependent tasks via `TaskCreate`:

#### 7a. Creation Task (claimable by the writer)

```
TaskCreate({
  "subject": "create-<short-child-descriptor>",
  "description": "<see template below>"
})
```

Capture the returned task ID (call it `createTaskId`); you'll need it to wire up the paired review task's dependency in 7b below.

Description template (use verbatim text, not summaries):

```
Create a child issue of type <CHILD_TYPE> under parent <PARENT_ID>.

Target scope for this child: <brief, lead-authored scope for this specific child — e.g., "authentication system" or "API rate limiting">.

Original User Requirements (verbatim):
---
<EXACT_ORIGINAL_INPUT_FROM_STEP_2>
---

Create ONLY this one child issue via the mcp__task-trellis__create_issue tool. Use `task-trellis-teams:issue-creation` as your authoring guide (read the sibling skill file via the Read tool if the Skill tool is unavailable in teammate mode).

After creating the issue:
1. Record the created child's issue ID in your response/log so it is visible to the reviewer task.
2. Mark this task done via TaskUpdate.
3. Send a content-free SendMessage activation nudge: `SendMessage({ to: "issue-reviewer", summary: "review ready", message: "review ready" })`. Do NOT include review instructions in the nudge — the reviewer reads its own lead-authored task.

Do NOT create grandchildren. Do NOT create issues outside this parent's scope. If anything is ambiguous enough to block creation, send a direct `SendMessage({ to: "team-lead", summary: "...", message: "..." })` describing the blocker.
```

#### 7b. Review Task (depends on the creation task)

`TaskCreate` does NOT accept dependencies at creation time. Create the review task first, then set its dependency on the creation task via `TaskUpdate` using the `createTaskId` captured in 7a:

```
reviewTaskId = TaskCreate({
  "subject": "review-<short-child-descriptor>",
  "description": "<see template below>"
})

TaskUpdate({
  "taskId": reviewTaskId,
  "addBlockedBy": [createTaskId]
})
```

Description template:

```
Review the child issue created by task "create-<short-child-descriptor>". The writer recorded the created issue ID when it marked that task done.

Verify the child issue against the original user requirements below for completeness, correctness, and appropriate scope.

Original User Requirements (verbatim):
---
<EXACT_ORIGINAL_INPUT_FROM_STEP_2>
---

Use `task-trellis-teams:issue-creation-review` as your review guide (read the sibling skill file via the Read tool if the Skill tool is unavailable in teammate mode).

If you find issues requiring changes:
- Send a SendMessage directly to the writer (`to: "writer-<level>"`) with specific, evidence-based findings.
- Wait for the writer to notify you back that fixes are ready, then re-review.
- Repeat until approved.

When approved, mark this task done via TaskUpdate.

If the review stalls (same finding returning, disagreement with the writer, or unclear requirements), send a SendMessage to `to: "team-lead"` for a decision. Do NOT approve a review just to move on.
```

**Dependencies.** The review task MUST be blocked by its paired creation task, set via the follow-up `TaskUpdate` with `addBlockedBy` shown in 7b. This is what enables the reviewer to pick up the review task only after the writer marks the creation task completed. Track the `createTaskId` and `reviewTaskId` for each child in your name→ID map so you can reference them in later updates (assigning owners, marking completed, etc.).

### 8. Run the Loop (Teammates Work)

Once the creation/review task pairs are on the shared task list, the writer and reviewer coordinate directly:

1. Writer claims a creation task via `TaskUpdate` (via its normal claim mechanism).
2. Writer creates the child issue, marks the creation task done.
3. Writer sends a content-free activation nudge to `reviewer` via `SendMessage`.
4. Reviewer picks up the now-unblocked review task.
5. Reviewer either:
   - **Approves** → marks review task done via `TaskUpdate`.
   - **Finds issues** → sends `SendMessage` directly to the writer with findings. Writer fixes via `mcp__task-trellis__update_issue`, sends activation nudge back, reviewer re-reviews. Repeat.

As the lead, you **do not drive this loop** task-by-task. You watch (via `TaskList` polling or the UI) and intervene only when:

- A teammate sends you a `SendMessage` (`to: "team-lead"`) with a blocker or question.
- The loop stalls (the same finding has been raised more than 3 times on the same child, or a task sits in `in progress` without progress).
- A teammate reports an infrastructure error (permission denied, MCP tool failure, etc.).

When a teammate escalates, use `AskUserQuestion` to get a decision from the user, then respond to the teammate via `SendMessage` with the guidance. Do NOT add new work items to the task list based on user answers unless the answer genuinely reveals a new needed child issue within scope.

### 9. Level Completion

The current level is complete when all creation and review tasks for the level are marked done and there are no open blocking messages. Confirm via `TaskList` filtered on the current level's task names.

- **If `--recursive` is NOT set:** Stop after this level. Proceed to step 10 (cleanup and summary).
- **If `--recursive` IS set:** For each newly-created child that itself needs children (e.g., each epic created under a project needs features; each feature needs tasks), loop back:
  - Shut down the current writer via the shutdown handshake: `SendMessage({ to: "<writer-name>", message: { type: "shutdown_request" } })`. The teammate responds with `{ type: "shutdown_response", request_id, approve }`. Approval terminates its process; on rejection, resolve whatever blocker the teammate cites via direct message, then re-request shutdown.
  - Spawn a fresh writer for the next level under each new parent via `Task` (step 6 template).
  - Author per-child creation/review task pairs for the next level (step 7 templates).
  - The reviewer persists — do NOT shut it down until the full run ends.

Do NOT recurse past the leaf level (tasks have no children).

### 10. Team Cleanup

At the end of the run (successful or not):

1. Shut down every still-active teammate: for each one, call `SendMessage({ to: "<teammate-name>", message: { type: "shutdown_request" } })` and wait for its `shutdown_response`. All teammates MUST be shut down before `TeamDelete` — `TeamDelete` fails if any teammate is still running.
2. Delete the team: `TeamDelete()` — takes no parameters; the team name comes from session context.

Cleanup is the **lead's** responsibility. Teammates MUST NOT run cleanup. If cleanup fails, report the failure to the user but do NOT leave the team in a half-cleaned state silently.

### 11. Report Summary

Produce a summary in the format:

```
## Issue Creation Complete (Agent Teams)

### Parent
<parent-id>: <title>

### Created Issues
- <child-id>: <title> (<type>) — review: <approved | approved-after-fixes | escalated>
- ...

### Review Outcomes
**Status**: Passed / Passed with Findings / Required Fixes / Escalated

<brief summary, e.g., "3 of 5 approved first pass; 2 fixed after reviewer findings on scope">

### Actions Taken
<any fixes applied via writer update_issue, any user escalations, any stalls>

### Next Steps
<suggestions: implement, add more detail, recurse into a specific child, etc.>
```

## Verbatim Requirements Preservation

The **Original User Requirements** block from step 2 MUST be embedded verbatim in:

- Every creation task description (step 7a).
- Every review task description (step 7b).
- Any direct `SendMessage` to a teammate that re-states or clarifies requirements.

Do NOT paraphrase. Do NOT summarize. The writer and reviewer must see the exact same requirements, unmodified, so that reviewer framing cannot bias toward what the writer thinks the user meant.

This is the same guarantee as `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md` — preserved here via the shared task list mechanism.

## Bias Guarantee

**Initial instructions to writer and reviewer always come from lead-authored task descriptions** on the shared task list — never from each other. Direct `SendMessage` between teammates is allowed only for:

- Activation nudges (content-free "start now" pings after a dependency clears).
- Fix-cycle iterations (specific findings from reviewer to writer, fix-ready notifications from writer to reviewer).

The reviewer MUST ignore any instructions it receives from the writer that conflict with its lead-authored review task. This is enforced by the `task-trellis-teams:trellis-issue-reviewer` agent definition itself but is re-asserted in each review task description.

## Autonomous Operation

When given a parent issue ID, proceed directly without asking for confirmation — the user has already decided by invoking this skill.

- Default to **coarser-grained issues** at the current level (fewer, larger children).
- Do NOT ask about granularity.
- Only use `AskUserQuestion` when:
  - Requirements are genuinely ambiguous and could be interpreted multiple ways.
  - Critical information is missing that cannot be inferred from context or codebase research.
  - A teammate escalated a blocker that needs a user decision.

## Error Handling

| Situation | Action |
|-----------|--------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not set | STOP, report to user, do NOT attempt workarounds |
| `TeamCreate` fails | STOP, report the exact error to user |
| Teammate spawn fails | STOP, clean up any created team, report to user |
| Teammate reports permission / MCP error | Surface to user via `AskUserQuestion`, do NOT retry automatically |
| Fix loop exceeds 3 rounds on the same finding | Interrupt both teammates via `SendMessage`; escalate to the user via `AskUserQuestion` for a decision before allowing a 4th round |
| Teammate goes silent / stalls | Check `TaskList` state; if stuck, send `SendMessage` nudge; if still stuck, escalate to user |

**Do NOT** categorize review findings as "minor" and skip them. Every finding is the writer's responsibility to address or justify. If the writer believes a finding is wrong, it must say so via `SendMessage` to the reviewer and let the reviewer confirm or escalate to the lead.

## References

- Agent Teams docs: https://code.claude.com/docs/en/agent-teams
- Existing subagent-based equivalent: `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md` (read for autonomous-operation and verbatim-preservation semantics)
- Worker skills used by teammates:
  - `task-trellis-teams:issue-creation` (writer's authoring guide)
  - `task-trellis-teams:issue-creation-review` (reviewer's review guide)
- Agent types spawned:
  - `task-trellis-teams:trellis-issue-writer`
  - `task-trellis-teams:trellis-issue-reviewer`

<rules>
  <critical>Verify CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 before any other action. STOP if not set.</critical>
  <critical>Preserve the original user requirements VERBATIM in every task description authored for writer and reviewer. Do NOT paraphrase or summarize.</critical>
  <critical>Bias guarantee: initial instructions to writer and reviewer come ONLY from lead-authored task-list entries, NEVER from each other. Direct messages between teammates are limited to activation nudges and fix-cycle iterations.</critical>
  <critical>Without `--recursive`, stop after creating only the immediate child level. Do NOT recursively decompose.</critical>
  <critical>Team cleanup is the lead's responsibility. Call `TeamDelete` at the end of the run (success or failure). Teammates MUST NOT run cleanup.</critical>
  <critical>If a teammate reports a permission error or infrastructure failure, STOP and report to the user via AskUserQuestion. Do NOT attempt workarounds.</critical>
  <critical>Address ALL review findings. Do NOT categorize findings as minor and skip them. If the writer believes a finding is wrong, it must justify via SendMessage to the reviewer, not silently ignore.</critical>
  <important>Spawn ONE persistent reviewer for the whole run. Spawn ONE writer per level; shut down old writer before spawning a new one when recursing.</important>
  <important>Default to coarser-grained issues at the current level — fewer, larger children. Do NOT ask about granularity.</important>
  <important>Use unique, stable teammate names (e.g., `writer-epics`, `writer-features`, `reviewer`) so SendMessage routing is unambiguous.</important>
  <important>Author review tasks with an explicit dependency on their paired creation task so the reviewer only unblocks after the writer completes.</important>
</rules>
