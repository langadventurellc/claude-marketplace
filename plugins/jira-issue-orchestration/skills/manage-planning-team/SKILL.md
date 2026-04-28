---
name: manage-planning-team
description: Internal skill. Runs inside the planning sub-session. Invokes investigate-jira-issue to produce a requirements artifact, then invokes create-trellis-issues to create Trellis issues from it. Signals completion to the conductor when done.
user-invocable: false
effort: medium
allowed-tools:
  - AskUserQuestion
  - Skill
  - Task
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor
---

# manage-planning-team

Internal skill that executes inside the planning sub-session.

## Context

This skill runs in a freshly spawned Claude Code sub-instance in its own terminal/tmux window. The sub's `Monitor` (watching `c2s.log`) is **already armed by the IPC preamble** injected by the launcher. Do NOT arm a Monitor here — doing so is unnecessary and may interfere with the preamble's tail.

The launcher preamble contains a `CHANNEL_ID=<value>` line. Extract this value and pass it as `channelId` to `send-message-to-conductor`.

The Jira issue key is provided in the instructions delivered by the conductor at session start.

## Workflow

Execute these steps in order. Each step is a prerequisite for the next.

### 1. Investigate the Jira issue

Delegate investigation to the `jira-investigator` subagent via the `Task` tool. The subagent runs `investigate-jira-issue` in its own context and returns only the artifact.

```
Task({
  subagent_type: "jira-issue-orchestration:jira-investigator",
  prompt: "Investigate the Jira issue <JIRA_KEY> and return the full artifact as your final message. The Jira key is: <JIRA_KEY received from conductor instructions>"
})
```

The prompt must be self-contained — the subagent starts from cold context with no access to the planning session. Pass the Jira key explicitly and instruct the subagent to return the full artifact (not a summary) as its final message.

Capture the `Task` return value as the artifact. This is the requirements summary or discovery document used in step 4.

### 2. Heartbeat to the conductor

The moment the `Task` in step 1 returns the artifact, immediately call `send-message-to-conductor` with an informational heartbeat:

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor({ channelId: "<channelId>", message: "planning: investigation complete, creating Trellis issues" })
```

This is not optional and is not contingent on anything. Do not pause to ask the user about the handoff — that decision is already made by this skill. The heartbeat is purely informational; the conductor does not act on it. After the heartbeat returns, proceed to step 3.

### 3. Clarify if needed

If the investigation surfaced ambiguity or missing information that must be resolved before creating Trellis issues, ask the user **directly in this sub's terminal window** using `AskUserQuestion`.

- Do NOT relay questions to the conductor via IPC.
- The user is watching this window; ask here and wait for their answer.
- If there are no blocking ambiguities, skip this step.
- Only proceed to step 4 once all blocking ambiguities are resolved.

### 4. Create Trellis issues

Invoke `create-trellis-issues` (from the `task-trellis-teams` plugin dependency) via the `Skill` tool, passing the artifact produced in step 1 (and incorporating any clarifications from step 3).

```
Skill({ skill: "task-trellis-teams:create-trellis-issues", args: "<artifact from step 1>" })
```

A planning run produces **exactly one root Trellis issue** for the Jira ticket — typically a feature (`F-…`), but may be an epic (`E-…`) or project (`P-…`) for larger work.

Wait for `create-trellis-issues` to complete, then capture the **root Trellis issue ID** from its summary (the "Parent" entry in its `## Issue Creation Complete` block, or the topmost issue in `### Created Issues` when the run created the root itself). Bind it as `TRELLIS_SCOPE` for step 5.

### 5. Signal completion

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor` with the bound `channelId` and a single-line done message that carries `TRELLIS_SCOPE` in the format `scope=<id>`:

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor({ channelId: "<channelId>", message: "planning done: trellis issues created scope=<TRELLIS_SCOPE>" })
```

The `scope=<id>` token is required — the conductor parses it to drive the implementation sub. Do not omit it, do not rename it, do not wrap the value in quotes.

The message **must not contain embedded newlines** (`\n` or `\r`). The tool rejects multi-line messages.

## Key Constraints

- **No Monitor arming.** The sub's `c2s.log` Monitor is already armed by the IPC preamble. This skill does not use the `Monitor` tool.
- **Ask users directly.** All clarification questions go to the user in this window via `AskUserQuestion` — never through the conductor via IPC.
- **Single-line IPC messages.** `send-message-to-conductor` rejects any message containing `\n` or `\r`. Keep the completion signal on one line.
- **Do not modify `create-trellis-issues`.** Invoke it as-is; it is out of scope.
