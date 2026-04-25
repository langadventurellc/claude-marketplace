---
name: manage-implementation-team
description: Internal skill. Runs inside the implementation sub-session. Invokes implement-trellis-issues to implement all open Trellis tasks, then invokes create-pr to open a draft GitHub PR. Signals completion to the conductor when done.
allowed-tools:
  - Skill
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor
---

# manage-implementation-team

Internal skill that runs inside the implementation sub-session. Implements all open Trellis tasks, opens a draft GitHub PR, and signals the conductor when done.

## Context

This skill is injected as the sub's user prompt by `conduct-orchestration-team --team-type implementation`. The sub's `Monitor` (watching `c2s.log`) is already armed by the IPC preamble before this skill runs — **do not arm a Monitor here**.

The launcher preamble contains a `CHANNEL_ID=<value>` line. Extract this value and pass it as `channelId` to `send-message-to-conductor`.

## Workflow

Execute these steps in order. Wait for each to complete before starting the next.

### 1. Implement Trellis tasks

Parse `scope=<TRELLIS_ID>` out of the conductor's instructions. The conductor sends a single line containing the Jira key followed by `scope=<TRELLIS_ID>` — bind the ID as `TRELLIS_SCOPE`. If the token is missing, stop and surface an error; do not fall back to running `implement-trellis-issues` without a scope.

Invoke `implement-trellis-issues` (from the `task-trellis-teams` plugin) via the `Skill` tool, passing `TRELLIS_SCOPE` as the input so the skill is anchored to the planning sub's tree:

```
Skill({ name: "task-trellis-teams:implement-trellis-issues", input: "<TRELLIS_SCOPE>" })
```

Wait for `implement-trellis-issues` to complete before proceeding. It handles its own testing — do not add a separate testing step.

### 2. Open a draft PR

Invoke `create-pr` via the `Skill` tool to commit any uncommitted changes, push, and open a GitHub draft PR.

```
Skill({ name: "create-pr" })
```

Draft quality is acceptable. Do **not** pass `--no-draft`. Capture the PR URL from the skill's output if available.

### 3. Signal completion

Extract `channelId` from the launcher preamble (`CHANNEL_ID=<value>` line), then call `mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor` with a single-line done message. Include the PR URL inline if available.

Example message: `implementation done: PR opened at https://github.com/org/repo/pull/123`

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor({ channelId: "<channelId>", message: "implementation done: PR opened at <url>" })
```

The message must contain **no embedded newlines** (`\n` or `\r`). Encode everything on one line.

## Key Constraints

- **Do not arm a Monitor.** The sub's `c2s.log` Monitor is already armed by the IPC preamble. This skill does not use the `Monitor` tool.
- **Draft PR only.** `create-pr` creates a draft PR by default. Do not pass `--no-draft`.
- **Single-line IPC messages.** `send-message-to-conductor` rejects messages with embedded newlines. Keep the completion message on one line.
- **No separate testing step.** `implement-trellis-issues` runs its own tests. Do not invoke a QA or testing team.
- **No Jira issue updates.** Do not call any Jira MCP tools.
- **Do not modify `implement-trellis-issues` or `create-pr`.** Invoke them as-is.
