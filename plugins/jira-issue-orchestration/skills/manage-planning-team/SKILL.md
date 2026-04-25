---
name: manage-planning-team
description: Internal skill. Runs inside the planning sub-session. Invokes investigate-jira-issue to produce a requirements artifact, then invokes create-trellis-issues to create Trellis issues from it. Signals completion to the conductor when done.
allowed-tools:
  - AskUserQuestion
  - Skill
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor
---

# manage-planning-team

Internal skill that executes inside the planning sub-session. It is not user-invokable — it is injected as the sub's prompt by `conduct-orchestration-team --team-type planning` via the `launch-orchestration-team` MCP tool's `prompt` argument.

## Context

This skill runs in a freshly spawned Claude Code sub-instance in its own iTerm/tmux window. The sub's `Monitor` (watching `c2s.log`) is **already armed by the IPC preamble** injected by the launcher. Do NOT arm a Monitor here — doing so is unnecessary and may interfere with the preamble's tail.

The launcher preamble contains a `CHANNEL_ID=<value>` line. Extract this value and pass it as `channelId` to `send-message-to-conductor`.

The Jira issue key is provided in the instructions delivered by the conductor at session start.

## Workflow

Execute these steps in order. Each step is a prerequisite for the next.

### 1. Investigate the Jira issue

Invoke `investigate-jira-issue` via the `Skill` tool, passing the Jira issue key received from the conductor's instructions.

```
Skill({ name: "investigate-jira-issue", input: "<JIRA_KEY>" })
```

Wait for the skill to complete. Its output — a requirements summary or technical-discovery document — is the artifact used in step 3.

**When `investigate-jira-issue` returns its document, your next action MUST be a `Skill` call to `task-trellis-teams:create-trellis-issues` (step 3). Do not stop. Do not ask the user about the handoff — that decision is already made by this skill.** The only exception is step 2: if the investigation surfaced blocking ambiguities that the user must resolve before issue creation, handle those first via `AskUserQuestion`, then proceed to step 3.

### 2. Clarify if needed

If the investigation reveals ambiguity or missing information that must be resolved before creating Trellis issues, ask the user **directly in this sub's iTerm window** using `AskUserQuestion`.

- Do NOT relay questions to the conductor via IPC.
- The user is watching this window; ask here and wait for their answer.
- Only proceed to step 3 once all blocking ambiguities are resolved.

### 3. Create Trellis issues

Invoke `create-trellis-issues` (from the `task-trellis-teams` plugin dependency) via the `Skill` tool, passing the artifact produced in step 1 (and incorporating any clarifications from step 2).

```
Skill({ name: "task-trellis-teams:create-trellis-issues", input: "<artifact from step 1>" })
```

Wait for `create-trellis-issues` to complete and confirm that issues were created before proceeding.

### 4. Signal completion

Extract `channelId` from the launcher preamble (`CHANNEL_ID=<value>` line), then call `mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor` with a single-line done message.

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor({ channelId: "<channelId>", message: "planning done: trellis issues created" })
```

The message **must not contain embedded newlines** (`\n` or `\r`). The tool rejects multi-line messages.

## Key Constraints

- **No Monitor arming.** The sub's `c2s.log` Monitor is already armed by the IPC preamble. This skill does not use the `Monitor` tool.
- **Ask users directly.** All clarification questions go to the user in this window via `AskUserQuestion` — never through the conductor via IPC.
- **Single-line IPC messages.** `send-message-to-conductor` rejects any message containing `\n` or `\r`. Keep the completion signal on one line.
- **Do not modify `create-trellis-issues`.** Invoke it as-is; it is out of scope.
