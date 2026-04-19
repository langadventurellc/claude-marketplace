---
name: create-trellis-issues
description: Orchestrates Trellis issue creation using Claude Code Agent Teams. Use when asked to "create trellis issues", "create and review issues", "create verified issues", or when you want issues created by a writer teammate and automatically reviewed by a reviewer teammate with direct-message fix loops. Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__list_issues
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

<critical>
**Lead Orchestration Rule — Read This First**

The lead DOES NOT write issues, review issues, or call issue-management tools directly on child issues. Every prohibited action below must be routed to the appropriate teammate instead.

Prohibited lead actions:
- Calling `mcp__plugin_task-trellis-teams_task-trellis__create_issue` to create a child issue (writer's job).
- Calling `mcp__plugin_task-trellis-teams_task-trellis__update_issue` on a child issue to apply review findings or fix content (writer's job after reviewer findings).
- Writing or editing any Trellis issue body directly from the lead session for a child issue.

Enforcement heuristic: If you find yourself about to call `create_issue` or `update_issue` on a child, STOP and ask: is this a teammate's job? It almost certainly is.
</critical>

Orchestrate issue creation using Claude Code's Agent Teams feature. The lead session (you) creates a team, authors per-child creation/review task pairs on the shared task list, spawns a persistent reviewer teammate plus a writer teammate for the current level, and lets the writer and reviewer coordinate directly via `SendMessage` for fix loops.

## Role of the Lead (You)

You are the **lead** — you do NOT write issues or review issues yourself. Your job is to:

1. Run preflight checks.
2. Create the agent team.
3. Author tasks on the shared task list with the original user requirements verbatim.
4. Spawn teammates.
5. Route `AskUserQuestion` when teammates escalate blockers.
6. Clean up the team at the end.

## Input

`$ARGUMENTS` format:

- `<parent-id>` — ID of the parent Trellis issue (e.g., `P-project-id`, `E-epic-id`, `F-feature-id`). Optional if the parent is obvious from prior conversation context.
- `--recursive` — optional flag. When set, the lead recurses down the hierarchy, spawning a fresh writer per level until all levels are written. The reviewer persists across all levels.

All remaining text in `$ARGUMENTS` is the **original user requirements** and MUST be preserved verbatim — see "Verbatim Requirements Preservation" below.

## Process

### 1. Preflight

Before doing anything else, **fetch the parent issue** via `mcp__plugin_task-trellis-teams_task-trellis__get_issue` to confirm it exists and determine its type — only if a parent ID was supplied in `$ARGUMENTS`. If no parent ID is provided, defer this check until step 3 resolves the level.

If the preflight check fails, STOP and report to the user. Do NOT attempt workarounds.

### 2. Capture Original Input Verbatim

**CRITICAL.** Before authoring any shared-task-list entries, store the exact user instructions verbatim:

```
Original User Requirements:
---
[EXACT_USER_INPUT_HERE]
---
```

Do NOT paraphrase, summarize, or modify it in any way. Then create a single dedicated task on the shared list as the canonical source of truth:

```
TaskCreate({
  subject: "requirements",
  description: "<EXACT_ORIGINAL_INPUT>\n\ndo not claim or complete this task",
  owner: "team-lead"
})
```

Capture the returned task ID as `requirementsTaskId`. This task is a read-only reference — never claimed, never completed by any teammate. The bias-prevention guarantee holds because writer and reviewer both read identical, unmodified bytes from this single source.

**2b. Classify lead-meta vs. product requirements.**

Before embedding requirements in tasks, scan the original input for sentences or clauses that are *addressed to the lead* rather than specifying what issues should contain. Lead-meta directives typically match patterns such as:
- "Before you shut down…" / "at the end of the run…"
- "Ask [teammates / agents] for…"
- "Pay attention to how…" / "observe whether…"
- "Produce a report / summary for me"
- Any instruction whose actor is the lead, not the issue content

First, create the directory if it does not exist:

```bash
Bash({ command: "mkdir -p ~/.cache/claude-trellis-teams/<team-name>" })
```

Then write lead-meta to `~/.cache/claude-trellis-teams/<team-name>/lead-meta.md` (where `<team-name>` is the name used in `TeamCreate`) using the `Write` tool. Read it back with the `Read` tool whenever you need it later in the run. Do NOT include it in any task description or `SendMessage` to a teammate.

The **product requirements** are everything that is NOT lead-meta: the scope, constraints, and acceptance criteria that define what child issues should contain. Only this portion is embedded verbatim in creation and review task descriptions.

If the entire user input is product requirements (no lead-meta), no classification is needed — embed the full input as before.

### 3. Determine Target Level

Resolve the level in this order:

1. **Parent ID provided** — use the parent's type to pick the child type:

   | Parent Type | Child Type to Create |
   |-------------|----------------------|
   | Project (`P-`) | Epics |
   | Epic (`E-`) | Features |
   | Feature (`F-`) | Tasks |

   Nothing else to decide; proceed to step 4.

2. **No parent, but the user's requirements name the level or types** (e.g., "create tasks for this flow", "break this into features", "a feature with a handful of tasks", "an epic and its features") — use that guidance directly. If the user implied a root and its children (e.g., "a feature with tasks"), the lead authors a root creation task + review task pair on the shared task list using the step 5a/5b templates verbatim (omit the parent field from the creation task description; the authoring guide for the root comes from the matching `issue-creation/<type>.md` file). Create the agent team (step 4), spawn the persistent reviewer (step 6) and a writer for the root level (step 7), send the 'begin assigned work' nudge, and wait for root approval before proceeding to child-level task authoring (step 5 for children).

3. **No parent and no level guidance** — read [`determine-starting-level.md`](determine-starting-level.md) in this skill directory and follow its decision procedure. That doc covers:
   - Picking the correct root level from scope signals.
   - Authoring root creation+review task pairs when applicable.
   - The narrow conditions under which you should escalate to the user.

   When that doc's action block says the lead creates a root issue, the lead instead authors root creation+review task pairs (step 5a/5b templates) and spawns a writer. Do NOT call `create_issue` from the lead.

   Do NOT ask the user for the level as a first move — only ask when `determine-starting-level.md` says the decision is genuinely ambiguous.

> **Root approval ordering constraint.** Root approval MUST complete (all root creation+review tasks marked done) before the lead authors child-level creation/review task pairs. Do not race ahead to child-level task authoring while root review is pending.
>
> The persistent reviewer spawned in step 6 handles both the root-level review and all subsequent child-level reviews. This is intentional and safe: the bias guarantee is preserved because the reviewer's initial instructions for each review come from a distinct lead-authored task on the shared task list — not from the writer or from prior review context.

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

### 5. Author Per-Child Tasks on the Shared Task List

Decide on the set of children to create based on the original requirements plus research of the codebase. You may use `Read`, `Grep`, `Bash`, or any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch) to scope the level before authoring tasks. Default to **coarser-grained** issues — fewer, larger children at the current level — not deeper decomposition.

For EACH planned child, author **two** dependent tasks via `TaskCreate`:

#### 5a. Creation Task (claimable by the writer)

```
TaskCreate({
  "subject": "create-<short-child-descriptor>",
  "description": "<see template below>"
})
```

Capture the returned task ID (call it `createTaskId`); you'll need it to wire up the paired review task's dependency in 5b below.

Description template (use verbatim text, not summaries):

```
Create a child issue of type <CHILD_TYPE> under parent <PARENT_ID>.

Scope: <brief, lead-authored scope for this child>.

Requirements: `TaskGet taskId="<requirementsTaskId>"` — single source of truth; read before creating.

Skill: `task-trellis-teams:issue-creation` (or read `plugins/task-trellis-teams/skills/issue-creation/SKILL.md` directly).

After creating:
1. Store the created ID: `TaskUpdate({ taskId: <THIS_TASK_ID>, metadata: { createdIssueId: "<T-xxx>" } })`
2. Mark this task done via TaskUpdate.
3. Nudge: `SendMessage({ to: "issue-reviewer", summary: "<created-issue-id> review ready", message: "review ready" })` — substitute the actual created issue ID (e.g., `T-xxx`) for `<created-issue-id>`.
```

#### 5b. Review Task (depends on the creation task)

`TaskCreate` does NOT accept dependencies at creation time. Create the review task first, then set its dependency on the creation task via `TaskUpdate` using the `createTaskId` captured in 5a:

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
Review child issue from "create-<short-child-descriptor>" (task ID: <CREATE_TASK_ID>).
Issue ID: `TaskGet(<CREATE_TASK_ID>)` → `metadata.createdIssueId`.

Requirements: `TaskGet taskId="<requirementsTaskId>"` — single source of truth; read before reviewing.

Skill: `task-trellis-teams:issue-creation-review` (or read `plugins/task-trellis-teams/skills/issue-creation-review/SKILL.md` directly).

Paired writer: `writer-<level>`.

When approved, mark this task done via TaskUpdate.
```

**Dependencies.** The review task MUST be blocked by its paired creation task, set via the follow-up `TaskUpdate` with `addBlockedBy` shown in 5b. This is what enables the reviewer to pick up the review task only after the writer marks the creation task completed. Track the `createTaskId` and `reviewTaskId` for each child in your name→ID map so you can reference them in later updates (assigning owners, marking completed, etc.).

### 6. Spawn the Persistent Reviewer

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

The reviewer's real work instructions come from the per-child review tasks authored in step 5 — the spawn prompt only nudges it to read the shared list.

### 7. Spawn the Writer for the Current Level

Spawn ONE writer teammate for the current level. It will be shut down at the end of this level (if recursing) or at team cleanup (if not).

```
Task({
  "team_name": "<team_name>",
  "subagent_type": "task-trellis-teams:trellis-issue-writer",
  "name": "writer-<level>",
  "description": "Writer creating <child-type> under <parent-id>",
  "prompt": "You are the writer teammate for this issue-creation run. Read your initial instructions from the shared task list only — specifically the creation tasks the lead authors. Follow the task-trellis-teams:trellis-issue-writer agent guardrails (stay within the assigned parent and level, send activation nudges via SendMessage to the reviewer named 'issue-reviewer' after each creation task, fix review findings sent back by the reviewer). Wait for the lead's 'begin assigned work' SendMessage nudge before claiming your first task."
})
```

Name the writer distinctly per level (e.g., `writer-epics`, `writer-features`, `writer-tasks-f-feature-x`) so `SendMessage` routing stays unambiguous.

### 8. Run the Loop (Teammates Work)

Once the creation/review task pairs are on the shared task list, the writer and reviewer coordinate directly:

1. **Lead sends start nudge.** After spawning both teammates (steps 6 and 7 complete), the lead MUST send a `SendMessage` to the writer:
   ```
   SendMessage({ to: "<writer-name>", summary: "<parent-id> begin assigned work", message: "begin assigned work" })
   ```
   Substitute the actual parent issue ID (e.g., `F-my-feature`) for `<parent-id>`. Do NOT embed instructions in this nudge — the writer reads its own task-list entries. This nudge exists solely to wake the writer from its initial idle state.

   > **Authoritative start signal**: This `SendMessage` nudge is the single authoritative activation trigger for the writer. When the lead sets `owner` on a task-list entry via `TaskUpdate`, the runtime automatically emits a `task_assignment` DM to that teammate as an invisible side-effect. That DM is **informational only** — writers and reviewers MUST NOT begin work on receipt of a `task_assignment` DM. Work begins only when the explicit `SendMessage` nudge above arrives.
2. Writer claims a creation task via `TaskUpdate` (via its normal claim mechanism).
3. Writer creates the child issue, marks the creation task done.
4. Writer sends an instruction-free activation nudge to `reviewer` via `SendMessage`. See `PROTOCOL.md` §Reviewer activation gate for the two-condition trigger the reviewer enforces.
5. Reviewer picks up the now-unblocked review task.
6. Reviewer either:
   - **Approves** → marks review task done via `TaskUpdate`.
   - **Finds issues** → sends `SendMessage` directly to the writer with findings. Writer fixes via `mcp__plugin_task-trellis-teams_task-trellis__update_issue`, sends activation nudge back, reviewer re-reviews. Repeat.

As the lead, you **do not drive this loop** task-by-task. You watch (via `TaskList` polling or the UI) and intervene only when:

- A teammate sends you a `SendMessage` (`to: "team-lead"`) with a blocker or question.
- The loop stalls (the same finding has been raised more than 3 times on the same child, or a task sits in `in progress` without progress).
- A teammate reports an infrastructure error (permission denied, MCP tool failure, etc.).

When a teammate escalates, use `AskUserQuestion` to get a decision from the user, then respond to the teammate via `SendMessage` with the guidance. Do NOT add new work items to the task list based on user answers unless the answer genuinely reveals a new needed child issue within scope.

### 9a. Cross-Sibling Review (required for 3+ siblings; optional for ≤2)

> **Note:** Cross-sibling review (step 9a) is NOT applicable at the root level because only one root issue is created per run.

When the number of children created at this level is **3 or more**, the lead MUST perform a cross-sibling consistency review using a **fresh** `trellis-issue-reviewer` teammate — never the persistent per-child reviewer. Reusing the persistent reviewer biases the cross-sibling pass with opinions already formed during individual reviews; a fresh teammate sees only the cross-sibling task.

The lead performs three sub-steps:

**Step 1 — Author the cross-sibling review task:**

```
TaskCreate({
  "subject": "cross-sibling-review-<parent-id>",
  "description": "<see template below>"
})
```

Persist this task's ID in your name→ID map as `crossSiblingTaskId`.

When the number of children is **2 or fewer**, this step is optional. The lead may skip steps 1–3 and proceed directly to step 9b.

**Cross-sibling review task description template:**

```
Perform a cross-sibling consistency review of all child issues created under <parent-id> at the <child-type> level.

Child issues to review: <comma-separated list of child issue IDs>

Check the following, in order:
1. **Scope overlap**: Do any two siblings claim responsibility for the same functionality, file area, or subsystem? Flag any overlap with the sibling pair involved and the conflicting scope language.
2. **Coverage gaps**: Do the siblings together cover all requirements from the product requirements below? List any requirement that no sibling addresses.
3. **Prerequisite coherence**: Are the prerequisite links between siblings correct? Flag any missing prerequisite (A must complete before B but B does not list A as a prerequisite) or spurious prerequisite (A lists B as a prerequisite but there is no logical dependency).

Product Requirements (verbatim):
---
<PRODUCT_REQUIREMENTS_FROM_STEP_2>
---

Use `task-trellis-teams:issue-creation-review` as your review guide and the cross-sibling rubric in that skill's SKILL.md. Send findings directly to the writer (<writer-name>) via SendMessage if changes to child issues are needed. Approve (mark this task done) when no blocking cross-sibling issues remain.
```

**Step 2 — Spawn the fresh cross-sibling reviewer:**

After authoring the cross-sibling task, spawn a dedicated reviewer teammate:

```
Task({
  "team_name": "<team_name>",
  "subagent_type": "task-trellis-teams:trellis-issue-reviewer",
  "name": "cross-sibling-reviewer-<parent-id>",
  "description": "Fresh reviewer for cross-sibling consistency pass under <parent-id>",
  "prompt": "You are the cross-sibling reviewer for this run. Read your instructions from the shared task list only — specifically the cross-sibling-review task the lead authored for <parent-id>. Follow the task-trellis-teams:trellis-issue-reviewer agent guardrails. Send findings via SendMessage to the writer by name; mark the task done when no blocking issues remain."
})
```

Then send a start nudge:

```
SendMessage({ to: "cross-sibling-reviewer-<parent-id>", summary: "<parent-id> begin cross-sibling review", message: "begin assigned work" })
```

**Step 3 — Wait for approval, then shut down the fresh reviewer:**

Wait for `crossSiblingTaskId` to be marked done (poll via `TaskList` or watch for a completion message from the reviewer). Once approved:

```
SendMessage({ to: "cross-sibling-reviewer-<parent-id>", message: { type: "shutdown_request" } })
```

Wait for its `shutdown_response` before proceeding to step 9b. Do NOT let the fresh reviewer linger past approval.

### 9b. Level Completion

Once all per-child tasks **and the cross-sibling review task (if authored)** are marked done and there are no open blocking messages, the level is complete. Confirm via `TaskList` filtered on the current level's task names.

- **If `--recursive` is NOT set:** Stop after this level. Proceed to step 10 (cleanup and summary).
- **If `--recursive` IS set:** For each newly-created child that itself needs children (e.g., each epic created under a project needs features; each feature needs tasks), loop back:
  - Shut down the current writer via the shutdown handshake: `SendMessage({ to: "<writer-name>", message: { type: "shutdown_request" } })`. The teammate responds with `{ type: "shutdown_response", request_id, approve }`. Approval terminates its process; on rejection, resolve whatever blocker the teammate cites via direct message, then re-request shutdown.
  - Author per-child creation/review task pairs for the next level (step 5 templates).
  - Spawn a fresh writer for the next level under each new parent via `Task` (step 7 template).
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

The lead MUST create exactly **one** `requirements` task per run (step 2) containing the verbatim input. All creation task descriptions (step 5a) and review task descriptions (step 5b) MUST reference it by ID via `TaskGet` — no inline embedding.

Lead-meta instructions (classified in step 2b) are NEVER placed in the `requirements` task or any teammate-visible task descriptions. They apply only to the lead's own run behavior (e.g., gathering observations before shutdown).

The bias guarantee holds: writer and reviewer both read identical, unmodified bytes from the same single `requirements` task. For N children, this produces one copy of the requirements instead of 2N inline copies.

This is the same guarantee as `plugins/task-trellis/skills/issue-creation-orchestration/SKILL.md` — preserved here via the shared task list mechanism.

## Bias Guarantee

**Initial instructions to writer and reviewer always come from lead-authored task descriptions** on the shared task list — never from each other. Direct `SendMessage` between teammates is allowed only for:

- Activation nudges (instruction-free "start now" pings after a dependency clears).
- Fix-cycle iterations (specific findings from reviewer to writer, fix-ready notifications from writer to reviewer).

The reviewer MUST ignore any instructions it receives from the writer that conflict with its lead-authored review task. This is enforced by the `task-trellis-teams:trellis-issue-reviewer` agent definition itself but is re-asserted in each review task description.

## Autonomous Operation

When given a parent issue ID **or** clear level guidance in the user's requirements, proceed directly without asking for confirmation — the user has already decided by invoking this skill. When neither is present, use `determine-starting-level.md` to decide autonomously before falling back to asking the user.

- Default to **coarser-grained issues** at the current level (fewer, larger children).
- Do NOT ask about granularity.
- Only use `AskUserQuestion` when:
  - The starting level is genuinely ambiguous and `determine-starting-level.md` directs you to ask.
  - Requirements are genuinely ambiguous and could be interpreted multiple ways.
  - Critical information is missing that cannot be inferred from context or codebase research.
  - A teammate escalated a blocker that needs a user decision.

## Error Handling

| Situation | Action |
|-----------|--------|
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
  <critical>The lead MUST create exactly one `requirements` task (step 2) containing the verbatim input. All creation and review task descriptions MUST reference it by ID via TaskGet. Do NOT embed verbatim requirements inline in 5a/5b templates. Lead-meta instructions (classified in step 2b) MUST NOT appear in the `requirements` task or any teammate-visible task descriptions.</critical>
  <critical>Bias guarantee: initial instructions to writer and reviewer come ONLY from lead-authored task-list entries, NEVER from each other. Direct messages between teammates are limited to activation nudges and fix-cycle iterations.</critical>
  <critical>Without `--recursive`, stop after creating only the immediate child level. Do NOT recursively decompose.</critical>
  <critical>Team cleanup is the lead's responsibility. Call `TeamDelete` at the end of the run (success or failure). Teammates MUST NOT run cleanup.</critical>
  <critical>If a teammate reports a permission error or infrastructure failure, STOP and report to the user via AskUserQuestion. Do NOT attempt workarounds.</critical>
  <critical>Address ALL review findings. Do NOT categorize findings as minor and skip them. If the writer believes a finding is wrong, it must justify via SendMessage to the reviewer, not silently ignore.</critical>
  <important>Spawn ONE persistent reviewer for the whole run (per-child reviews only). Spawn ONE writer per level; shut down old writer before spawning a new one when recursing. For the cross-sibling review (step 9a), spawn a FRESH reviewer teammate — never reuse the persistent reviewer — and shut it down on approval.</important>
  <important>Default to coarser-grained issues at the current level — fewer, larger children. Do NOT ask about granularity.</important>
  <important>Use unique, stable teammate names (e.g., `writer-epics`, `writer-features`, `reviewer`) so SendMessage routing is unambiguous.</important>
  <important>Author review tasks with an explicit dependency on their paired creation task so the reviewer only unblocks after the writer completes.</important>
  <critical>After spawning both teammates in steps 6 and 7, the lead MUST send a `SendMessage` to the writer with `summary: "<parent-id> begin assigned work"` (using the actual parent issue ID) before stepping back to watch. Do NOT rely on the writer polling for work autonomously.</critical>
  <critical>When 3 or more children are created at a level, the lead MUST author and wait for a cross-sibling review task before declaring level completion. Do NOT skip cross-sibling review for large decompositions.</critical>
</rules>
