---
name: manage-implementation-teams
description: Internal skill. Runs inside the implementation sub-session. Invokes implement-trellis-issues to implement all open Trellis tasks, then invokes create-pr to open a draft GitHub PR. Signals completion to the conductor when done.
allowed-tools:
  - Skill
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor
---

# manage-implementation-teams

Internal skill that runs inside the implementation sub-session. Implements all open Trellis tasks, opens a draft GitHub PR, and signals the conductor when done.

## Context

This skill is injected as the sub's user prompt by `conduct-orchestration-team --team-type implementation`. The sub's `Monitor` (watching `c2s.log`) is already armed by the IPC preamble before this skill runs — **do not arm a Monitor here**.

## Workflow

Execute these steps in order. Wait for each to complete before starting the next.

### 1. Implement Trellis tasks

Invoke `implement-trellis-issues` (from the `task-trellis-teams` plugin) via the `Skill` tool. This implements all open Trellis tasks created by the planning sub.

```
Skill({ name: "task-trellis-teams:implement-trellis-issues" })
```

Wait for `implement-trellis-issues` to complete before proceeding. It handles its own testing — do not add a separate testing step.

### 2. Open a draft PR

Invoke `create-pr` via the `Skill` tool to commit any uncommitted changes, push, and open a GitHub draft PR.

```
Skill({ name: "create-pr" })
```

Draft quality is acceptable. Do **not** pass `--no-draft`. Capture the PR URL from the skill's output if available.

### 3. Signal completion

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-conductor` with a single-line done message. Include the PR URL inline if available.

Example message: `implementation done: PR opened at https://github.com/org/repo/pull/123`

The message must contain **no embedded newlines** (`\n` or `\r`). Encode everything on one line.

## Key Constraints

- **Do not arm a Monitor.** The sub's `c2s.log` Monitor is already armed by the IPC preamble. This skill does not use the `Monitor` tool.
- **Draft PR only.** `create-pr` creates a draft PR by default. Do not pass `--no-draft`.
- **Single-line IPC messages.** `send-message-to-conductor` rejects messages with embedded newlines. Keep the completion message on one line.
- **No separate testing step.** `implement-trellis-issues` runs its own tests. Do not invoke a QA or testing team.
- **No Jira issue updates.** Do not call any Jira MCP tools.
- **Do not modify `implement-trellis-issues` or `create-pr`.** Invoke them as-is.
