---
name: orchestrate-jira-issue
description: Primary user entry point. Given a Jira issue key (e.g. ACME-1234), validates the issue then runs a planning sub-session (producing Trellis issues) followed by an implementation sub-session (opening a PR). Use when the user says "orchestrate", "run orchestration on", or "implement" a Jira issue via this plugin.
allowed-tools:
  - AskUserQuestion
  - Bash
  - Monitor
  - Skill
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__set-config
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__claim-conductor
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__launch-orchestration-team
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__terminate-sub
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__stop-orchestration-team
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

### Phase 0 — Configuration setup

Required keys: `atlassianBaseUrl`, `atlassianCloudId`, `jiraProjectKey`.

1. Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config` with no arguments. Read the returned `values` object.
2. For each required key missing or empty in `values`, ask the user with `AskUserQuestion` to provide it.
3. If any keys were collected from the user, persist them in a single `mcp__plugin_jira-issue-orchestration_issue-orchestration__set-config` call: `{ values: { <collected keys> } }`.
4. Bind for later phases:
   - `BASE_URL` ← `atlassianBaseUrl`
   - `CLOUD_ID` ← `atlassianCloudId` (used by `getJiraIssue` in Phase 1 step 3)
   - `PROJECT_KEY` ← `jiraProjectKey`

### Phase 1 — Initialization

Execute these steps in order; each is a prerequisite for the next.

1. **Claim conductor channel**  
   Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__claim-conductor`, optionally passing `label` (e.g., the Jira issue key).  
   Store the returned `channelId`, `c2sLogPath`, and `s2cLogPath`. Hold `channelId` for the entire run — do not call `claim-conductor` again.

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
   Invoke `conduct-orchestration-team --team-type planning --channel-id <channelId> --additional-instructions <issue_id>` via the `Skill` tool, where `<issue_id>` is the Jira issue key from Phase 1.  
   `conduct-orchestration-team` manages the full planning sub lifecycle (launch → hello → instructions → done → terminate). Wait for it to return before proceeding.

2. **Capture and verify the Trellis scope**  
   Parse `scope=<TRELLIS_ID>` out of the planning sub's `done` message (forwarded by `conduct-orchestration-team` Step 5). Bind the value as `TRELLIS_SCOPE`. If the token is absent or empty, stop and inform the user — the planning sub failed its contract.  
   Confirm the root issue exists by calling `mcp__plugin_task-trellis-teams_task-trellis__get_issue({ id: "<TRELLIS_SCOPE>" })`. If the call fails or returns no issue, stop and inform the user.  
   Confirm there is implementable work under it: call `mcp__plugin_task-trellis-teams_task-trellis__list_issues({ scope: "<TRELLIS_SCOPE>", type: "task", status: ["open", "in-progress"] })` and check the result is non-empty (when the root itself is a task, `get_issue` is sufficient — skip the `list_issues` check). If no open tasks are found under a non-task root, stop and inform the user — do not launch the implementation sub.

### Phase 3 — Transition Between Phases

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__terminate-sub({ channelId })` to kill the planning sub while keeping the channel alive. The same `channelId` and `s2cLogPath` remain valid — no new `claim-conductor` or `Monitor` is needed.

### Phase 4 — Implementation

1. **Launch implementation sub-session**  
   Invoke `conduct-orchestration-team --team-type implementation --channel-id <channelId> --additional-instructions "<issue_id> scope=<TRELLIS_SCOPE>"` via the `Skill` tool, where `<issue_id>` is the same Jira issue key from Phase 1 and `<TRELLIS_SCOPE>` is the root Trellis ID captured in Phase 2 step 2. Both values ride on a single line — do not embed newlines.  
   Wait for it to return.

2. **Confirm PR and report to user**  
   Run `gh pr list --state open --limit 5` (via `Bash`) to confirm a PR was opened.  
   Report the PR URL to the user.

### Phase 5 — Final Teardown

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__stop-orchestration-team({ channelId })` to tear down the channel, remove IPC directories, and clean up. This is called exactly once, at the very end of the run.

## Key Constraints

- **No conductor agent type.** This skill runs in the user's existing Claude Code session. Do not define a new agent type.
- **Monitor before launch.** Always follow the Phase 1 ordering: claim → arm Monitor → fetch Jira. Never call `launch-orchestration-team` before the Monitor is armed.
- **One channel for the full run.** `claim-conductor` is called exactly once (Phase 1). Use `terminate-sub({ channelId })` between phases — it kills the active sub while preserving the channel for the next launch. `stop-orchestration-team({ channelId })` is called only once at the very end.
- **Single sub at a time.** Do not call `launch-orchestration-team` if a sub is already active.
- **Single-line IPC messages only.** If you ever send a message directly via IPC (not via `conduct-orchestration-team`), ensure it contains no embedded newlines.
