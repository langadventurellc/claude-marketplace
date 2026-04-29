---
name: manage-planning-team
description: Internal skill. Runs inside the planning sub-session. Spawns a single-teammate investigation team to run investigate-jira-issue, then invokes create-trellis-issues to create Trellis issues from the artifact. Signals completion to the conductor when done.
user-invocable: false
effort: medium
allowed-tools:
  - Skill
  - Task
  - TeamCreate
  - TeamDelete
  - SendMessage
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor
  - mcp__plugin_task-trellis-teams_task-trellis__read_project_file
---

## Context

This skill runs in a freshly spawned Claude Code sub-instance in its own terminal/tmux window. The sub's `Monitor` (watching `c2s.log`) is **already armed by the IPC preamble** injected by the launcher. Do NOT arm a Monitor here — doing so is unnecessary and may interfere with the preamble's tail.

The launcher preamble contains a `CHANNEL_ID=<value>` line. Extract this value and pass it as `channelId` to `send-message-to-conductor`.

The Jira issue key is provided in the instructions delivered by the conductor at session start.

## Workflow

Execute these steps in order. Each step is a prerequisite for the next.

### 1. Investigate the Jira issue (single-teammate team)

Run investigation as a transient single-teammate team so the investigator can interact with the user directly via `AskUserQuestion`. The team is created, used, and torn down entirely within this step before any other team is created.

Bind `JIRA_KEY` from the conductor instructions and derive `ARTIFACT_PATH = "investigations/<JIRA_KEY>.md"`. This path is the agreed contract between the lead and the teammate.

**1a. Create the investigation team.**

```
TeamCreate({
  team_name: "jira-investigation-<JIRA_KEY>",
  description: "Single-teammate investigation team for <JIRA_KEY> — runs investigate-jira-issue and persists the artifact to a Trellis project file."
})
```

**1b. Spawn the investigator teammate.**

Do NOT pass a `model` parameter to `Task`. Agent frontmatter is authoritative; the `Task`-tool `model` enum strips the `[1m]` context-window variant declared in frontmatter and silently downgrades the teammate.

```
Task({
  team_name: "jira-investigation-<JIRA_KEY>",
  subagent_type: "jira-issue-orchestration:jira-investigator",
  name: "investigator-<JIRA_KEY>",
  description: "Investigation teammate for <JIRA_KEY>",
  prompt: "Investigate Jira issue <JIRA_KEY>. Write the full artifact via mcp__plugin_task-trellis-teams_task-trellis__write_project_file to path '<ARTIFACT_PATH>'. When the file is written, SendMessage({ to: 'team-lead', summary: 'investigation complete', message: 'artifact written to <ARTIFACT_PATH>' }) and then wait for shutdown_request. If a load-bearing ambiguity arises, ask the user directly via AskUserQuestion in your own window — do not relay through the lead."
})
```

**1c. Wait for the teammate's completion signal.**

Block until `SendMessage` arrives from `investigator-<JIRA_KEY>` containing `artifact written`. While you wait, the teammate may surface `AskUserQuestion` prompts directly to the user — that is intended; do not intervene.

If the teammate instead reports a blocker via `SendMessage` (missing access, ambiguous Jira key, etc.), surface it to the user via `AskUserQuestion`, reply to the teammate via `SendMessage`, and continue waiting.

**1d. Read the artifact.**

```
mcp__plugin_task-trellis-teams_task-trellis__read_project_file({ path: "<ARTIFACT_PATH>" })
```

Bind the file contents as the artifact for step 3. If the read fails or returns empty, `SendMessage` the teammate to retry the write before proceeding to teardown.

**1e. Shut down and tear down.**

```
SendMessage({ to: "investigator-<JIRA_KEY>", message: { type: "shutdown_request" } })
// wait for shutdown_response
TeamDelete()
```

`TeamDelete` takes no parameters and resolves the team from session context. The investigation team **must be fully torn down here** — `create-trellis-issues` in step 3 calls `TeamCreate` itself, and only one team can be active in this session at a time.

### 2. Create Trellis issues

Invoke `create-trellis-issues` (from the `task-trellis-teams` plugin dependency) via the `Skill` tool, passing the artifact bound in step 1d.

```
Skill({ skill: "task-trellis-teams:create-trellis-issues", args: "<artifact from step 1d>" })
```

A planning run produces **exactly one root Trellis issue** for the Jira ticket — typically a feature (`F-…`), but may be an epic (`E-…`) or project (`P-…`) for larger work.

Wait for `create-trellis-issues` to complete, then capture the **root Trellis issue ID** from its summary (the "Parent" entry in its `## Issue Creation Complete` block, or the topmost issue in `### Created Issues` when the run created the root itself). Bind it as `TRELLIS_SCOPE` for step 4.

### 3. Signal completion

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor` with the bound `channelId` and a single-line done message that carries `TRELLIS_SCOPE` in the format `scope=<id>`:

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor({ channelId: "<channelId>", message: "planning done: trellis issues created scope=<TRELLIS_SCOPE>" })
```

The `scope=<id>` token is required — the conductor parses it to drive the implementation sub. Do not omit it, do not rename it, do not wrap the value in quotes.

The message **must not contain embedded newlines** (`\n` or `\r`). The tool rejects multi-line messages.

## Key Constraints

- **No Monitor arming.** The sub's `c2s.log` Monitor is already armed by the IPC preamble. This skill does not use the `Monitor` tool.
- **One team at a time.** The investigation team in step 1 must be deleted before step 3 invokes `create-trellis-issues` (which creates its own team). `TeamDelete` resolves the team from session context, so leaving the investigation team active will collide.
- **Single-line IPC messages.** `send-message-to-conductor` rejects any message containing `\n` or `\r`. Keep the completion signal on one line.
- **Do not modify `create-trellis-issues`.** Invoke it as-is; it is out of scope.
