---
name: create-trellis-issues
description: Orchestrates Trellis issue creation using Claude Code Agent Teams. Use when asked to "create trellis issues", "create and review issues", "create verified issues", or when you want issues created by a writer teammate and automatically reviewed by a reviewer teammate with direct-message fix loops.
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - TeamCreate
  - TeamDelete
  - Agent
  - TaskCreate
  - TaskUpdate
  - TaskList
  - SendMessage
  - AskUserQuestion
  - Read
  - Write
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

Orchestrate issue creation using Claude Code's Agent Teams feature. The lead session (you) creates a team, authors per-child creation/review task pairs on the shared task list, spawns one writer/reviewer pair per sibling set with the `Agent` tool (passing `subagent_type`, `team_name`, and `name`), and lets the writer and reviewer coordinate directly via `SendMessage` for fix loops. Do NOT use the `Task` tool for spawning — `Task` is an output-retrieval tool for background processes and cannot create teammates.

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
- `--no-recursive` — optional flag. When set, the lead stops after creating only the immediate child level. Default behavior is to recurse down the hierarchy, spawning a fresh writer/reviewer pair per sibling set until all levels are written.

All remaining text in `$ARGUMENTS` is the **original user requirements** and MUST be preserved verbatim in the `requirements` task created in step 4 — and only there.

## Process

### 1. Preflight

Before doing anything else, **fetch the parent issue** via `mcp__plugin_task-trellis-teams_task-trellis__get_issue` to confirm it exists and determine its type — only if a parent ID was supplied in `$ARGUMENTS`. If no parent ID is provided, defer this check until step 2 resolves the level.

### 2. Determine Target Level

Resolve the level in this order:

1. **Parent ID provided** — use the parent's type to pick the child type:

   | Parent Type    | Child Type to Create |
   | -------------- | -------------------- |
   | Project (`P-`) | Epics                |
   | Epic (`E-`)    | Features             |
   | Feature (`F-`) | Tasks                |

   Nothing else to decide; proceed to step 3.

2. **No parent, but the user's requirements name the level or types** (e.g., "create tasks for this flow", "break this into features", "a feature with a handful of tasks", "an epic and its features") — use that guidance directly. If the user implied a root and its children (e.g., "a feature with tasks"), the lead authors a root creation task + review task pair on the shared task list using the step 5a/5b templates verbatim (omit the parent field from the creation task description; the authoring guide for the root comes from the matching `issue-creation/<type>.md` file). Spawn the writer/reviewer pair for the root level (step 6), send the pointer nudge for the root creation task (step 7), and wait for root approval before proceeding to child-level task authoring (step 5 for children).

3. **No parent and no level guidance** — read [`determine-starting-level.md`](determine-starting-level.md) in this skill directory and follow its decision procedure. That doc covers:
   - Picking the correct root level from scope signals.
   - Authoring root creation+review task pairs when applicable.
   - The narrow conditions under which you should escalate to the user.

   Do NOT ask the user for the level as a first move — only ask when `determine-starting-level.md` says the decision is genuinely ambiguous.

> **Root approval ordering constraint.** Root approval MUST complete (all root creation+review tasks marked done) before the lead authors child-level creation/review task pairs. Do not race ahead to child-level task authoring while root review is pending.

### 3. Create the Agent Team

> **Tool conventions used below:** `TaskCreate` returns an opaque task ID (persist a name→ID map across the run so you can reference tasks in later `TaskUpdate` calls). `TaskUpdate` identifies tasks by `taskId` (not subject). `SendMessage` uses `to` (not `recipient`) and requires `summary` when `message` is a plain string. `TeamDelete` takes no parameters.

**Always call `TeamCreate` before any `TaskCreate` — including the `requirements` task in step 4.** `TeamCreate` initializes the shared task list on disk; any tasks authored before it are destroyed when the team is created and must be re-authored.

Use `TeamCreate` to create the team:

```
TeamCreate({
  "team_name": "trellis-create-<short-parent-id>",
  "description": "Issue creation team for <parent-id> — writer creates children at the <level> level; reviewer verifies against original requirements."
})
```

Choose a stable, human-readable `team_name`.

### 4. Capture Original Input Verbatim

With the team (and its shared task list) now in place, create a single dedicated task on the shared list as the canonical source of truth. Embed the exact user instructions verbatim — do NOT paraphrase, summarize, or modify them:

```
TaskCreate({
  subject: "requirements",
  description: "<EXACT_ORIGINAL_INPUT>\n\ndo not claim or complete this task",
  owner: "team-lead"
})
```

Capture the returned task ID as `requirementsTaskId`. This task is a read-only reference — never claimed, never completed by any teammate. The bias-prevention guarantee holds because writer and reviewer both read identical, unmodified bytes from this single source.

**4b. Classify lead-meta vs. product requirements.**

Before embedding requirements in tasks, scan the original input for sentences or clauses that are _addressed to the lead_ rather than specifying what issues should contain. Lead-meta directives typically match patterns such as:

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

### 5. Author Per-Child Tasks on the Shared Task List

Decide on the set of children to create based on the original requirements plus research of the codebase. You may use `Read`, `Grep`, `Bash`, or any available information-gathering tool (e.g. Perplexity, Gemini, context7, WebSearch/WebFetch) to scope the level before authoring tasks. Default to **coarser-grained** issues — fewer, larger children at the current level — not deeper decomposition.

#### 5.0 Sibling-set sizing rule — max 5 children per parent

**Hard cap: no parent may have more than 5 direct children in a single run.** Writers and reviewers degrade in quality and coherence once a sibling set exceeds 5 — they lose track of what has already been written, repeat or contradict each other across siblings, and reviewers miss issues. (The cohesion reviewer sees parent + children = up to 6 items, which is still tractable because it only runs once at the end.)

Before authoring creation/review task pairs for a level, count the planned children under each parent. If any parent would exceed 5, restructure **before** authoring tasks:

- **Split the parent into multiple parents at the same level**, each owning ≤5 children. Examples:
  - A feature that would have 9 tasks → split into 2 features (5 + 4 tasks).
  - An epic that would have 13 features → split into 3 epics (~4-5 features each).
  - A project that would have 8 epics → split into 2 projects (4 + 4 epics).
- Choose the split along natural seams in the work (e.g., user-facing vs. infra, distinct subsystems, independent user stories) — not by arbitrary slicing of a cohesive unit.
- **If the parent was supplied by the user** (the run's root parent ID, or a lead-created intermediate parent already approved earlier in this run), the lead must restructure the level above it: create additional sibling parents at the same level as the supplied parent and redistribute the planned children. Note the restructure in the final summary so the user can see what happened.
- This rule applies at **every level** the run produces — root-level fan-out, mid-level recursion, and leaf-level sibling sets. When recursing (step 9b) into a newly-created parent, apply the same count-then-split check before authoring that parent's children.

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

Skill: `task-trellis-teams:issue-creation`

After creating:
1. Store the created ID: `TaskUpdate({ taskId: <THIS_TASK_ID>, metadata: { createdIssueId: "<T-xxx>" } })`
2. Mark this task done via TaskUpdate.
3. Nudge: `SendMessage({ to: "reviewer-<level>-<parent-id>", summary: "<review-task-id> begin", message: "claim and begin <review-task-list-task-id>" })` — substitute the actual reviewer name, level, parent ID, and review task-list task ID.
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

Skill: `task-trellis-teams:issue-creation-review`

Paired writer: `writer-<level>-<parent-id>`.

When approved, mark this task done via TaskUpdate.
```

**Dependencies.** The review task MUST be blocked by its paired creation task, set via the follow-up `TaskUpdate` with `addBlockedBy` shown in 5b. This is what enables the reviewer to pick up the review task only after the writer marks the creation task completed. Track the `createTaskId` and `reviewTaskId` for each child in your name→ID map so you can reference them in later updates (assigning owners, marking completed, etc.).

### 6. Spawn the Writer/Reviewer Pair for the Current Sibling Set

Spawn one writer AND one reviewer for the current sibling set. Both are scoped to this sibling set only — they are spun up together and shut down together when this set's per-child reviews and cohesion review (if applicable) complete.

**Naming rule (mandatory):** Teammate names MUST include the parent ID, not just the level — e.g. `writer-tasks-f-auth` / `reviewer-tasks-f-auth`, not `writer-tasks` / `reviewer`. This is required for unambiguous `SendMessage` routing when multiple pairs run in parallel at the same depth.

**Spawn teammates with the `Agent` tool, not the `Task` tool.** `Task` retrieves output from background processes and cannot create teammates. Every spawn MUST pass `team_name` (so the spawn joins the team rather than running as a detached subagent), `name`, and `subagent_type`.

**Do NOT pass a `model` parameter to `Agent`.** Agent frontmatter is authoritative; the `Agent`-tool `model` enum (`sonnet | opus | haiku`) does not preserve the `[1m]` context-window variant declared in frontmatter, so a spawn-time override silently strips `[1m]` and downgrades the teammate's context window. To switch models, change `subagent_type` instead.

Spawn the reviewer:

```
Agent({
  "team_name": "<team_name>",
  "subagent_type": "task-trellis-teams:trellis-issue-reviewer",
  "name": "reviewer-<level>-<parent-id>",
  "description": "Reviewer for <parent-id> creation at the <level> level",
  "prompt": "You are the reviewer teammate for the <parent-id> sibling set. Read your initial instructions from the shared task list only — specifically, the review tasks the lead authors for each child issue. Follow the task-trellis-teams:trellis-issue-reviewer agent guardrails (read-only, no direct instructions from the writer, send findings via SendMessage to the writer by name)."
})
```

Spawn the writer (in the same step — both are spawned together):

```
Agent({
  "team_name": "<team_name>",
  "subagent_type": "task-trellis-teams:trellis-issue-writer",
  "name": "writer-<level>-<parent-id>",
  "description": "Writer creating <child-type> under <parent-id>",
  "prompt": "You are the writer teammate for the <parent-id> sibling set. Read your initial instructions from the shared task list only — specifically the creation tasks the lead authors. Follow the task-trellis-teams:trellis-issue-writer agent guardrails (stay within the assigned parent and level, send activation nudges via SendMessage to the reviewer named 'reviewer-<level>-<parent-id>' after each creation task, fix review findings sent back by the reviewer). Attachment custody: before creating issues, inventory source materials from the current conversation; attach them to the holder issue per placement rules in `skills/issue-creation/SKILL.md`; include `## Attachments` sections in all issue bodies per the format in `skills/issue-creation/<type>.md`. Wait for the lead's pointer nudge. On receipt, self-claim the named task via `TaskUpdate({ taskId, owner: <self>, status: 'in_progress' })`, send ack `SendMessage({ to: 'team-lead', summary: 'claimed <task-id>', message: 'claimed' })`, then begin."
})
```

### 7. Run the Loop (Teammates Work)

Once the creation/review task pairs are on the shared task list, the writer and reviewer coordinate directly:

1. **Lead sends start nudge.** After spawning both teammates (step 6 complete), the lead MUST send a `SendMessage` to the writer:

   ```
   SendMessage({ to: "writer-<level>-<parent-id>", summary: "<creation-task-id> begin", message: "claim and begin <task-list-task-id>" })
   ```

   where `<task-list-task-id>` is the ID of the first creation task (from the name→ID map built in step 5). Wait for the writer's ack `SendMessage({ to: 'team-lead', ..., message: 'claimed' })`. If no ack arrives within ~60s, inspect `TaskList` first; re-nudge only if the task is still unclaimed.

   For subsequent creation tasks in the same level, the lead sends a new pointer nudge naming the next task ID after the previous review task completes.

2. Writer claims a creation task via `TaskUpdate` (via its normal claim mechanism).
3. Writer creates the child issue, marks the creation task done.
4. Writer sends a pointer-only activation nudge to `reviewer-<level>-<parent-id>` via `SendMessage`. See `plugins/task-trellis-teams/PROTOCOL.md` §Reviewer activation gate.
5. Reviewer picks up the now-unblocked review task.
6. Reviewer either:
   - **Approves** → marks review task done via `TaskUpdate`.
   - **Finds issues** → sends `SendMessage` directly to the writer with findings. Writer fixes via `mcp__plugin_task-trellis-teams_task-trellis__update_issue`, sends activation nudge back, reviewer re-reviews. Repeat.

As the lead, you **do not drive this loop** task-by-task. You watch (via `TaskList` polling or the UI) and intervene only when:

- A teammate sends you a `SendMessage` (`to: "team-lead"`) with a blocker or question.
- The loop stalls (the same finding has been raised more than 3 times on the same child, or a task sits in `in progress` without progress).
- A teammate reports an infrastructure error (permission denied, MCP tool failure, etc.).

When a teammate escalates, use `AskUserQuestion` to get a decision from the user, then respond to the teammate via `SendMessage` with the guidance. Do NOT add new work items to the task list based on user answers unless the answer genuinely reveals a new needed child issue within scope.

### 9a. Cohesion Review (Parent/Children Alignment)

> **Note:** Cohesion review fires on **every parent/child edge** produced in the run. The only skip case is a run that produced standalone children with no parent at all (e.g. a flat list of tasks at the root with no parent supplied and no root issue created). When a parent ID was supplied to the run, the first level the run creates is already a parent/child edge and gets a cohesion review. Setting `--no-recursive` does NOT suppress the cohesion review — if a parent/child edge exists, the review fires regardless.
>
> The root-level issue creation itself produces no parent/child edge (there is no parent above the root). But the very next level down DOES produce a parent/child edge and gets a cohesion review.
>
> **Cadence under recursion:** At each level boundary, after per-child reviews complete for a parent's children, run the cohesion review for **that parent** before recursing into the grandchildren. Example: for an Epic → 3 Features → tasks-per-feature run — cohesion #1 = Epic + 3 Features (after the features are individually reviewed, before any task-level pairs spawn); cohesions #2/#3/#4 = each Feature + its tasks (after that feature's tasks are individually reviewed, fired independently per feature as each feature's task set finishes).
>
> **Fresh reviewer is preserved:** The cohesion review always spawns a fresh `trellis-issue-reviewer` — NOT the per-sibling-set reviewer that already reviewed each child individually. Reusing the per-set reviewer would bias the alignment pass with opinions formed during individual reviews; a fresh reviewer sees only the cohesion task.

The lead performs three sub-steps:

**Step 1 — Author the cohesion review task:**

```
TaskCreate({
  "subject": "cohesion-review-<parent-id>",
  "description": "<see template below>"
})
```

Persist this task's ID in your name→ID map as `cohesionTaskId`.

**Cohesion review task description template:**

```
Perform a cohesion review of parent issue <parent-id> and the children just created under it.

Parent issue: <parent-id>
Children to review: <comma-separated list of child issue IDs>

Requirements: `TaskGet taskId="<requirementsTaskId>"` — single source of truth; read before reviewing.

Check the following, in order:
1. **Parent alignment**: Do the children, taken as a whole, deliver what the parent issue says it needs? Walk each parent acceptance criterion and scope clause and confirm at least one child addresses it. List any parent requirement not addressed by any child.
2. **Scope overlap**: Do any two siblings claim responsibility for the same functionality, file area, or subsystem? Flag any overlap with the sibling pair involved and the conflicting scope language. (No-op when only one child exists.)
3. **Coverage gaps**: Do the children together cover all requirements from the requirements task above? List any requirement that no child addresses.
4. **Prerequisite coherence**: Are the prerequisite links between siblings correct? Flag any missing or spurious prerequisite. (No-op when only one child exists.)
5. **Attachment consistency**: Verify the sibling set respects attachment custody rules — attachments reside on the shared parent (not duplicated across siblings), every sibling that depends on an attachment has a correctly formatted `## Attachments` section.

Use `task-trellis-teams:issue-creation-review` as your review guide and the cohesion rubric in that skill's SKILL.md. Send findings directly to the writer (<writer-name>) via SendMessage if changes to child issues are needed.

**Always notify the lead (`team-lead`) of every decision via SendMessage — silence is NOT acceptance.** The lead is blocked waiting on an explicit signal; if you do not send one, the entire run stalls. Send a message to `team-lead` at each of these points:

- **On approval (no blocking issues):** `SendMessage({ to: "team-lead", summary: "cohesion approved <parent-id>", message: "cohesion review approved; marked <cohesionTaskId> done" })` AND mark this task done via TaskUpdate.
- **On findings sent to the writer:** after the SendMessage to the writer, also `SendMessage({ to: "team-lead", summary: "cohesion findings sent <parent-id>", message: "sent <N> findings to <writer-name>; awaiting fixes before re-review" })`.
- **After each re-review iteration:** notify the lead of the new status (still iterating with new findings, now approved, or escalating).
- **On escalation / blocker:** `SendMessage({ to: "team-lead", summary: "cohesion blocked <parent-id>", message: "<reason>" })` and stop.
```

**Step 2 — Spawn the fresh cohesion reviewer:**

After authoring the cohesion task, spawn a dedicated reviewer teammate:

```
Agent({
  "team_name": "<team_name>",
  "subagent_type": "task-trellis-teams:trellis-issue-reviewer",
  "name": "cohesion-reviewer-<parent-id>",
  "description": "Fresh reviewer for cohesion pass under <parent-id>",
  "prompt": "You are the cohesion reviewer for parent issue <parent-id>. Read your instructions from the shared task list only — specifically the cohesion-review task the lead authored for <parent-id>. Follow the task-trellis-teams:trellis-issue-reviewer agent guardrails. Send findings via SendMessage to the writer by name; mark the task done when no blocking issues remain. **You MUST notify `team-lead` via SendMessage of every decision — approval, findings sent, ongoing iteration, or escalation. Silence is not acceptance; the lead stalls the entire run waiting on an explicit signal from you.**"
})
```

Then send a start nudge:

```
SendMessage({ to: "cohesion-reviewer-<parent-id>", summary: "<cohesion-task-id> begin", message: "claim and begin <cohesionTaskId>" })
```

**Step 3 — Wait for approval, then shut down the fresh cohesion reviewer:**

Wait for an explicit `SendMessage` from `cohesion-reviewer-<parent-id>` to `team-lead` reporting its decision (approval, findings sent, iteration in progress, or escalation). The reviewer is required to message the lead on every decision — do NOT treat silence as acceptance. `TaskList` polling is a backup signal only; if the cohesion task is marked done but no message arrived, something went wrong (re-nudge the reviewer or escalate).

If the reviewer reports findings sent to the writer or an in-progress iteration, keep waiting for the eventual approval or escalation message — do not advance until cohesion is explicitly approved. Once approved:

```
SendMessage({ to: "cohesion-reviewer-<parent-id>", message: { type: "shutdown_request" } })
```

Wait for its `shutdown_response` before proceeding to step 9b. Do NOT let the fresh reviewer linger past approval.

### 9b. Level Completion

Once all per-child tasks **and the cohesion review task (if applicable)** are marked done and there are no open blocking messages, the level is complete. Confirm via `TaskList` filtered on the current level's task names.

**Shut down the current sibling-set pair.** When the sibling set's per-child reviews AND cohesion review (if applicable) are approved, shut down BOTH the writer and the reviewer for that set via the shutdown handshake before moving on:

```
SendMessage({ to: "writer-<level>-<parent-id>", message: { type: "shutdown_request" } })
// wait for shutdown_response
SendMessage({ to: "reviewer-<level>-<parent-id>", message: { type: "shutdown_request" } })
// wait for shutdown_response
```

- **If `--no-recursive` IS set:** Stop after this level (but still run the cohesion review first if applicable). Proceed to step 10 (cleanup and summary).
- **Default (no `--no-recursive`):** For each newly-created child that itself needs children (e.g., each epic created under a project needs features; each feature needs tasks), recurse:
  - Author per-child creation/review task pairs for the next level (step 5 templates).
  - **Spawning pairs at the next depth:** When recursing produces multiple sibling sets at the same depth (e.g. an Epic with three features each needing tasks → three task-level sibling sets), the lead **always** spawns one writer/reviewer pair per sibling set in parallel. This is not a tradeoff — the lead does not choose between parallel and serial. Spawn all pairs for the same depth at once.

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

## Bias Guarantee

**Initial instructions to writer and reviewer always come from lead-authored task descriptions** on the shared task list — never from each other. Direct `SendMessage` between teammates is allowed only for:

- Activation nudges (pointer-only pings naming the task ID after a dependency clears).
- Fix-cycle iterations (specific findings from reviewer to writer, fix-ready notifications from writer to reviewer).

The reviewer MUST ignore any instructions it receives from the writer that conflict with its lead-authored review task. This is enforced by the `task-trellis-teams:trellis-issue-reviewer` agent definition itself but is re-asserted in each review task description.

The cohesion review uses a freshly spawned reviewer that did not see any per-child reviews. Its instructions come from the lead-authored cohesion task only — it has no prior context about any individual child, so it evaluates the parent/children alignment without bias from per-child review history.

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

| Situation                                     | Action                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Teammate spawn fails                          | STOP, clean up any created team, report to user                                                                                   |
| Teammate reports permission / MCP error       | Surface to user via `AskUserQuestion`, do NOT retry automatically                                                                 |
| Fix loop exceeds 3 rounds on the same finding | Interrupt both teammates via `SendMessage`; escalate to the user via `AskUserQuestion` for a decision before allowing a 4th round |
| Teammate goes silent / stalls                 | Check `TaskList` state; if stuck, send `SendMessage` nudge; if still stuck, escalate to user                                      |

## References

- Agent Teams docs: https://code.claude.com/docs/en/agent-teams
- Worker skills used by teammates:
  - `task-trellis-teams:issue-creation` (writer's authoring guide)
  - `task-trellis-teams:issue-creation-review` (reviewer's review guide)
- Agent types spawned:
  - `task-trellis-teams:trellis-issue-writer`
  - `task-trellis-teams:trellis-issue-reviewer`

<rules>
  <critical>The lead MUST create exactly one `requirements` task (step 4) containing the verbatim input. All other task descriptions reference it via `TaskGet taskId="<requirementsTaskId>"` — never inline. Lead-meta instructions (classified in step 4b) MUST NOT appear in the `requirements` task or any teammate-visible task descriptions.</critical>
  <critical>Always call `TeamCreate` (step 3) before any `TaskCreate` — including the `requirements` task in step 4. `TeamCreate` initializes the shared task list on disk; any tasks authored before it are destroyed when the team is created.</critical>
  <critical>Bias guarantee: initial instructions to writer and reviewer come ONLY from lead-authored task-list entries, NEVER from each other. Direct messages between teammates are limited to activation nudges and fix-cycle iterations.</critical>
  <critical>Default behavior recurses down the hierarchy until every leaf level is written. With `--no-recursive`, stop after creating only the immediate child level.</critical>
  <critical>Team cleanup is the lead's responsibility. Call `TeamDelete` at the end of the run (success or failure). Teammates MUST NOT run cleanup.</critical>
  <critical>If a teammate reports a permission error or infrastructure failure, STOP and report to the user via AskUserQuestion. Do NOT attempt workarounds.</critical>
  <critical>Address ALL review findings. Do NOT categorize findings as minor and skip them. If the writer believes a finding is wrong, it must justify via SendMessage to the reviewer, not silently ignore.</critical>
  <critical>Spawn teammates with the `Agent` tool, not the `Task` tool. Every spawn MUST pass `team_name`, `name`, and `subagent_type`. The `Task` tool retrieves output from background processes and cannot create teammates.</critical>
  <critical>NEVER pass a `model` parameter to the `Agent` tool when spawning teammates. Agent frontmatter is authoritative — the `Agent`-tool `model` enum (`sonnet | opus | haiku`) does not preserve the `[1m]` context-window variant declared in frontmatter, so a spawn-time override silently strips `[1m]` and downgrades the teammate's context window. To switch models, change `subagent_type` instead.</critical>
  <important>Spawn one writer/reviewer pair per sibling set; shut BOTH down when the set's per-child reviews and cohesion review are complete. For the cohesion review (step 9a), spawn a FRESH reviewer teammate — never reuse the per-sibling-set reviewer — and shut it down on approval.</important>
  <important>Default to coarser-grained issues at the current level — fewer, larger children. Do NOT ask about granularity.</important>
  <critical>Hard cap of 5 children per parent in any single run. Before authoring creation/review task pairs for a level, count the planned children under each parent; if any would exceed 5, split that parent into multiple parents at the same level (each owning ≤5 children) before authoring tasks. Applies at every level — including recursion in step 9b. Writers and reviewers lose coherence above 5 siblings; the cohesion reviewer's parent+children view of up to 6 is fine because it only fires once.</critical>
  <important>Use unique, stable teammate names that include the parent ID (e.g., `writer-tasks-f-auth`, `reviewer-tasks-f-auth`) so SendMessage routing is unambiguous when multiple pairs run in parallel at the same depth.</important>
  <important>Author review tasks with an explicit dependency on their paired creation task so the reviewer only unblocks after the writer completes.</important>
  <critical>After spawning both teammates, the lead MUST send a pointer-only `SendMessage` to the writer naming the first creation task ID before stepping back. The message body is `'claim and begin <task-list-task-id>'`. Do NOT embed instructions. Wait for the writer's 'claimed' ack before proceeding.</critical>
  <critical>Whenever a parent issue has children created under it in this run, the lead MUST author and wait for a cohesion review task before declaring level completion. Skip only when there is no parent (standalone children at the root). The cohesion review fires regardless of whether --no-recursive is set.</critical>
  <critical>The cohesion reviewer MUST notify `team-lead` via SendMessage of every decision (approval, findings sent to the writer, ongoing iteration, escalation). Silence is NOT acceptance — the lead is blocked waiting on an explicit signal and the entire run stalls if the reviewer omits this. The lead-authored cohesion task description and the reviewer's spawn prompt both encode this requirement.</critical>
</rules>
