---
name: conduct-orchestration-team
description: Internal skill. Manages the full lifecycle of one planning or implementation sub-session. Takes --team-type <planning|implementation>. Launches the sub, waits for hello handshake, sends instructions, waits for done signal from the manage-*-team skill, tears down.
allowed-tools:
  - Monitor
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__launch-orchestration-team
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__terminate-sub
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-orchestration-team
---

# conduct-orchestration-team

Internal skill. Manages the full lifecycle of one planning or implementation sub-session: launches the sub, exchanges the `hello` handshake, sends instructions, waits for the completion signal, then tears down.

> **Not user-invokable.** Called only by `orchestrate-jira-issue` via the `Skill` tool.

## Usage

```
conduct-orchestration-team --team-type <planning|implementation> --channel-id <channelId> [--additional-instructions <text>]
```

- `--team-type` — **Required.** Must be `planning` or `implementation`.
- `--channel-id` — **Required.** The channel ID returned by `claim-conductor` in Phase 1 of the caller. Passed to every IPC tool call.
- `--additional-instructions` — The IPC instruction payload sent to the sub after the `hello` handshake (Step 4). This is the explicit channel for caller-supplied per-run context such as the Jira issue key (e.g. `ACME-1234`). Its value is also appended verbatim to the team prompt (Step 1). Must be a single line — do not embed newlines.

## Ordering Constraint (load-bearing)

**The Monitor must be armed by the caller before this skill is invoked.** The sub sends `hello` immediately after booting. Because `tail -n 0` drops all lines written before the tail is armed, if the Monitor is not yet armed when the sub launches, the `hello` will be silently lost and the conductor will hang indefinitely.

## Workflow

Execute these steps in order. Each step depends on the previous.

### Step 1 — Build team prompt

Construct the prompt that will be injected as the user prompt in the sub-session. The prompt must instruct the sub to invoke the appropriate manage-\*-team skill for its team type:

- **`planning`**: Instruct the sub to invoke `manage-planning-team`. That skill calls `investigate-jira-issue`, then `create-trellis-issues`, then signals completion via `send-message-to-conductor`.

  Example prompt template:
  ```
  Invoke the manage-planning-team skill. It will guide the full planning workflow for this sub-session, including investigation, Trellis issue creation, and completion signaling via IPC.
  ```

- **`implementation`**: Instruct the sub to invoke `manage-implementation-team`. That skill calls `implement-trellis-issues`, then `create-pr`, then signals completion via `send-message-to-conductor`.

  Example prompt template:
  ```
  Invoke the manage-implementation-team skill. It will guide the full implementation workflow for this sub-session, including Trellis task implementation, PR creation, and completion signaling via IPC.
  ```

If `--additional-instructions` was provided, append that text verbatim at the end of the prompt, separated by a blank line.

**Do not bypass manage-\*-team skills** by calling sub-skills (`investigate-jira-issue`, `create-trellis-issues`, etc.) directly in the prompt. The manage-\*-team skills own user interaction and the completion-signal contract.

### Step 2 — Launch sub-session

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__launch-orchestration-team` with the channel ID and team prompt:

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__launch-orchestration-team({ channelId: "<channelId>", prompt: "<team-prompt>" })
```

Prerequisites already satisfied at this point:
- Monitor is armed (by the caller before this skill is invoked).

### Step 3 — Wait for `hello`

Block on the Monitor until a `hello` event arrives from the sub. This is the **only** liveness signal — do not assume the sub is ready until this message is received.

**Do NOT send any IPC message before `hello` arrives.** This ordering is load-bearing: the sub arms its own Monitor on `c2s.log` before sending `hello`, so any message sent before `hello` would be written to `c2s.log` before the sub's tail is armed, and would be silently dropped.

If no `hello` arrives within a reasonable timeout (e.g., 60 seconds), call `mcp__plugin_jira-issue-orchestration_issue-orchestration__terminate-sub({ channelId })` for teardown and surface an error to the caller.

### Step 4 — Send instructions

After receiving `hello`, call `mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-orchestration-team` with the `--additional-instructions` value as the IPC payload — send it verbatim. `--additional-instructions` is the explicit channel for caller-supplied per-run context (e.g. the Jira issue key). Do not construct or augment this payload; the caller is responsible for its contents.

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-orchestration-team({ channelId: "<channelId>", message: "<instruction>" })
```

**Single-line messages only.** The IPC transport splits on newlines — a message containing `\n` or `\r` will be split into multiple events and corrupt the protocol. If a multi-line payload is ever truly needed, encode it as JSONL (one JSON object per line), not raw newlines.

### Step 5 — Wait for completion

Monitor subsequent Monitor events for the completion signal from the manage-\*-team skill via `send-message-to-conductor`. Match any message that **contains** `done` as a substring (e.g. `planning done: trellis issues created`, `implementation done: PR opened at <url>`). When the signal is received, forward the full message (including any payload) to the caller.

The sub may also exit without sending a clean completion signal (crash, user interrupt, etc.). Handle both cases:
- Clean: message containing `done` received → forward the full message, then proceed to teardown.
- Unclean: Monitor stream closes or sub process exits without a message containing `done` → proceed to teardown, then surface a warning to the caller indicating the sub may not have completed successfully.

### Step 6 — Teardown

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__terminate-sub`:

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__terminate-sub({ channelId: "<channelId>" })
```

This kills only the active sub (sends `__peer_exit__`, kills the tmux session) while preserving the channel directory and log paths. The caller (`orchestrate-jira-issue`) owns final channel cleanup via `stop-orchestration-team`.

**Always run teardown**, whether the sub completed normally or not. Do not leave tmux sessions orphaned.

## Critical Constraints

- **Never send IPC before `hello`.** Steps 3 → 4 ordering is non-negotiable. Any message sent before `hello` arrives will be dropped by the sub's unarmed Monitor.
- **Inject manage-\*-team skills as the prompt.** These skills own user interaction (asking clarifying questions directly in the sub's iTerm window) and the `done`-signal contract. Bypassing them breaks the completion-detection protocol.
- **Completion signal contains `done`.** The conductor matches any incoming IPC message that contains `done` as a substring (e.g. `planning done: trellis issues created`, `implementation done: PR opened at <url>`). Forward the full message to the caller.
- **Single-line IPC messages only.** Newlines (`\n`, `\r`) in a message split it across Monitor events. Never embed newlines; use JSONL if a structured multi-line payload is required.
- **Teardown is always required.** Run `terminate-sub({ channelId })` in all exit paths, including errors. This skill does not call `stop-orchestration-team` — that belongs to the caller.
