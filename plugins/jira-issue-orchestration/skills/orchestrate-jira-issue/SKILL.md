---
name: orchestrate-jira-issue
description: Primary user entry point. Given a Jira issue key (e.g. CORE-1234), validates the issue then runs a planning sub-session (producing Trellis issues) followed by an implementation sub-session (opening a PR). Use when the user says "orchestrate", "run orchestration on", or "implement" a Jira issue via this plugin.
allowed-tools:
  - AskUserQuestion
  - Bash
  - Monitor
  - Read
  - Skill
  - mcp__issue-orchestration__claim-conductor
  - mcp__issue-orchestration__stop-orchestration-team
  - mcp__plugin_atlassian_atlassian__getJiraIssue
  - mcp__plugin_task-trellis-teams_task-trellis__list_issues
---

# orchestrate-jira-issue

Validates a Jira issue, runs a planning sub-session that produces Trellis tasks, then runs an implementation sub-session that opens a PR.

## Usage

```
/orchestrate-jira-issue <issue_id>
```

If `<issue_id>` is not provided, ask for it with `AskUserQuestion` before proceeding.

## Ordering Constraint (load-bearing)

**Always arm a `Monitor` on `s2cLogPath` BEFORE calling any launch tool.** The sub's first message (`hello`) is the only liveness signal — it is written immediately after the sub boots. Because `tail -n 0` discards all lines written before the tail is armed, arming the Monitor even slightly after the launch call will silently miss the handshake, causing the conductor to hang waiting for a message that was already dropped.

## Workflow

### Phase 1 — Initialization

Execute these steps in order; each is a prerequisite for the next.

1. **Claim conductor channel**  
   Call `mcp__issue-orchestration__claim-conductor`.  
   Store the returned `channelId`, `c2sLogPath`, and `s2cLogPath`.

2. **Arm persistent Monitor** *(must happen before any launch)*  
   Start a persistent Monitor on `s2cLogPath`:
   ```
   Monitor({ persistent: true, command: "tail -n 0 -F <s2cLogPath>" })
   ```
   Do not proceed to the Jira fetch or any launch until this Monitor is running.

3. **Validate Jira issue**  
   Fetch the issue via `mcp__plugin_atlassian_atlassian__getJiraIssue` using the provided key.  
   - If the fetch fails (auth error, 404, network issue), stop immediately and surface the error to the user.  
   - If the issue status is Done, Cancelled, or Closed, stop and inform the user — do not proceed.

### Phase 2 — Planning

1. **Launch planning sub-session**  
   Invoke `conduct-orchestration-team --team-type planning --additional-instructions <issue_id>` via the `Skill` tool, where `<issue_id>` is the Jira issue key from Phase 1.  
   `conduct-orchestration-team` manages the full planning sub lifecycle (launch → hello → instructions → done → stop). Wait for it to return before proceeding.

2. **Verify Trellis issues were created**  
   Call `mcp__plugin_task-trellis-teams_task-trellis__list_issues` and check that open tasks exist under the expected parent feature.  
   If no Trellis issues are found, stop and inform the user — do not launch the implementation sub.

### Phase 3 — Re-initialize Channel

`stop-orchestration-team` (called by `conduct-orchestration-team` at the end of Phase 2) clears all channel state. A new channel is required before launching the implementation sub.

1. **Claim a new conductor channel**  
   Call `mcp__issue-orchestration__claim-conductor` again.  
   Store the new `channelId` and `s2cLogPath` (the old values are stale).

2. **Arm a new persistent Monitor**  
   Start a new persistent Monitor on the new `s2cLogPath`:
   ```
   Monitor({ persistent: true, command: "tail -n 0 -F <new-s2cLogPath>" })
   ```
   The previous Monitor was watching a now-removed file path and must not be reused.

### Phase 4 — Implementation

1. **Launch implementation sub-session**  
   Invoke `conduct-orchestration-team --team-type implementation --additional-instructions <issue_id>` via the `Skill` tool, where `<issue_id>` is the same Jira issue key from Phase 1.  
   Wait for it to return.

2. **Confirm PR and report to user**  
   Run `gh pr list --state open --limit 5` (via `Bash`) to confirm a PR was opened.  
   Report the PR URL to the user.

## Key Constraints

- **No conductor agent type.** This skill runs in the user's existing Claude Code session. Do not define a new agent type.
- **Monitor before launch.** Always follow the Phase 1 ordering: claim → arm Monitor → fetch Jira. Never call `launch-orchestration-team` before the Monitor is armed.
- **Re-claim between phases.** After `stop-orchestration-team` clears state, `claim-conductor` must be called again before Phase 4. Reusing the old `channelId` or `s2cLogPath` will fail.
- **Single sub at a time.** Do not call `launch-orchestration-team` if a sub is already active.
- **Single-line IPC messages only.** If you ever send a message directly via IPC (not via `conduct-orchestration-team`), ensure it contains no embedded newlines.
