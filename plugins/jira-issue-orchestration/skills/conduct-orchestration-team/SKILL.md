---
name: conduct-orchestration-team
description: Internal skill. Manages the full lifecycle of one planning or implementation sub-session. Takes --team-type <planning|implementation>. Arms the conductor Monitor, launches the sub, waits for hello handshake, sends instructions, waits for done signal from the manage-*-team skill, tears down.
allowed-tools:
  - Monitor
  - Read
  - Bash
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__launch-orchestration-team
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__stop-orchestration-team
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-orchestration-team
---

# conduct-orchestration-team

Internal skill. Manages the full lifecycle of one planning or implementation sub-session: arms the conductor Monitor, launches the sub, exchanges the `hello` handshake, sends instructions, waits for the completion signal, then tears down.

> **Not user-invokable.** Called only by `orchestrate-jira-issue` via the `Skill` tool.

## Usage

```
conduct-orchestration-team --team-type <planning|implementation> [--additional-instructions <text>]
```

- `--team-type` — **Required.** Must be `planning` or `implementation`.
- `--additional-instructions` — The IPC instruction payload sent to the sub after the `hello` handshake (Step 5). This is the explicit channel for caller-supplied per-run context such as the Jira issue key (e.g. `CORE-1234`). Its value is also appended verbatim to the team prompt (Step 2). Must be a single line — do not embed newlines.

## Ordering Constraint (load-bearing)

**Arm the Monitor BEFORE calling `launch-orchestration-team`.** The sub sends `hello` immediately after booting. Because `tail -n 0` drops all lines written before the tail is armed, if the Monitor is armed after the launch, the `hello` will be silently lost and the conductor will hang indefinitely.

## Workflow

Execute these steps in order. Each step depends on the previous.

### Step 1 — Read state and arm conductor Monitor

1. Resolve the state file path and load it. Run `Bash`: `echo "${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/jira-issue-orchestration}/state.json"`, then use the `Read` tool on the printed path. This file is written by `claim-conductor` and contains `s2cLogPath` (the sub→conductor log path).

   If the file is missing or `s2cLogPath` is absent, stop immediately — the conductor has not claimed a channel. Surface a clear error to the caller.

2. If a persistent Monitor on `s2cLogPath` is already running in this session (armed by a prior call), skip to Step 2. Otherwise, arm one now:

   ```
   Monitor({ persistent: true, command: "tail -n 0 -F <s2cLogPath>" })
   ```

   **Requires Claude Code v2.1.98+.** If the Monitor tool is unavailable (Bedrock/Vertex/Foundry environment, or `DISABLE_TELEMETRY` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` env vars set), stop immediately with a clear error explaining the requirement.

   Do not proceed to Step 2 until the Monitor is confirmed running.

### Step 2 — Build team prompt

Construct the prompt that will be injected as the user prompt in the sub-session. The prompt must instruct the sub to invoke the appropriate manage-\*-team skill for its team type:

- **`planning`**: Instruct the sub to invoke `manage-planning-team`. That skill calls `orchestration-investigate-jira-issue`, then `create-trellis-issues`, then signals completion via `send-message-to-conductor`.

  Example prompt template:
  ```
  Invoke the manage-planning-team skill. It will guide the full planning workflow for this sub-session, including investigation, Trellis issue creation, and completion signaling via IPC.
  ```

- **`implementation`**: Instruct the sub to invoke `manage-implementation-teams`. That skill calls `implement-trellis-issues`, then `orchestration-create-pr`, then signals completion via `send-message-to-conductor`.

  Example prompt template:
  ```
  Invoke the manage-implementation-teams skill. It will guide the full implementation workflow for this sub-session, including Trellis task implementation, PR creation, and completion signaling via IPC.
  ```

If `--additional-instructions` was provided, append that text verbatim at the end of the prompt, separated by a blank line.

**Do not bypass manage-\*-team skills** by calling sub-skills (`orchestration-investigate-jira-issue`, `create-trellis-issues`, etc.) directly in the prompt. The manage-\*-team skills own user interaction and the completion-signal contract.

### Step 3 — Launch sub-session

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__launch-orchestration-team` with the team prompt as the `prompt` argument:

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__launch-orchestration-team({ prompt: "<team-prompt>" })
```

Prerequisites already satisfied at this point:
- Monitor is armed (Step 1).
- Conductor channel is claimed (state file exists).

### Step 4 — Wait for `hello`

Block on the Monitor until a `hello` event arrives from the sub. This is the **only** liveness signal — do not assume the sub is ready until this message is received.

**Do NOT send any IPC message before `hello` arrives.** This ordering is load-bearing: the sub arms its own Monitor on `c2s.log` before sending `hello`, so any message sent before `hello` would be written to `c2s.log` before the sub's tail is armed, and would be silently dropped.

If no `hello` arrives within a reasonable timeout (e.g., 60 seconds), call `mcp__plugin_jira-issue-orchestration_issue-orchestration__stop-orchestration-team` for teardown and surface an error to the caller.

### Step 5 — Send instructions

After receiving `hello`, call `mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-orchestration-team` with the `--additional-instructions` value as the IPC payload — send it verbatim. `--additional-instructions` is the explicit channel for caller-supplied per-run context (e.g. the Jira issue key). Do not construct or augment this payload; the caller is responsible for its contents.

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__send-message-to-orchestration-team({ message: "<instruction>" })
```

**Single-line messages only.** The IPC transport splits on newlines — a message containing `\n` or `\r` will be split into multiple events and corrupt the protocol. If a multi-line payload is ever truly needed, encode it as JSONL (one JSON object per line), not raw newlines.

### Step 6 — Wait for completion

Monitor subsequent Monitor events for the completion signal from the manage-\*-team skill via `send-message-to-conductor`. Match any message that **contains** `done` as a substring (e.g. `planning done: trellis issues created`, `implementation done: PR opened at <url>`). When the signal is received, forward the full message (including any payload) to the caller.

The sub may also exit without sending a clean completion signal (crash, user interrupt, etc.). Handle both cases:
- Clean: message containing `done` received → forward the full message, then proceed to teardown.
- Unclean: Monitor stream closes or sub process exits without a message containing `done` → proceed to teardown, then surface a warning to the caller indicating the sub may not have completed successfully.

### Step 7 — Teardown

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__stop-orchestration-team`:

```
mcp__plugin_jira-issue-orchestration_issue-orchestration__stop-orchestration-team()
```

This tool sends the `__peer_exit__` sentinel to the sub, kills the tmux session (authoritative shutdown), removes the IPC channel directory, and clears channel state from `${CLAUDE_PLUGIN_DATA}/state.json`.

**Always run teardown**, whether the sub completed normally or not. Do not leave tmux sessions or IPC directories orphaned.

## Critical Constraints

- **Never send IPC before `hello`.** Steps 4 → 5 ordering is non-negotiable. Any message sent before `hello` arrives will be dropped by the sub's unarmed Monitor.
- **Inject manage-\*-team skills as the prompt.** These skills own user interaction (asking clarifying questions directly in the sub's iTerm window) and the `done`-signal contract. Bypassing them breaks the completion-detection protocol.
- **Completion signal contains `done`.** The conductor matches any incoming IPC message that contains `done` as a substring (e.g. `planning done: trellis issues created`, `implementation done: PR opened at <url>`). Forward the full message to the caller.
- **Single-line IPC messages only.** Newlines (`\n`, `\r`) in a message split it across Monitor events. Never embed newlines; use JSONL if a structured multi-line payload is required.
- **Monitor is NOT declared in `plugin.json`.** It is armed dynamically inside this skill per channel. Do not add a `monitors` key to the plugin manifest.
- **Monitor requires Claude Code v2.1.98+.** Unavailable on Bedrock/Vertex/Foundry or when `DISABLE_TELEMETRY` or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` are set. Always check availability and surface a clear error if missing.
- **State file is the source of truth.** Read `${CLAUDE_PLUGIN_DATA}/state.json` to obtain `s2cLogPath`; do not hard-code or construct paths manually.
- **Teardown is always required.** Run `stop-orchestration-team` in all exit paths, including errors.
