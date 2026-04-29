---
name: configure-jira-orchestration
description: >
  Configure the Jira orchestration plugin's per-project settings — Atlassian base URL, cloud
  ID, and Jira project key. Use when the user says "configure jira orchestration", "set up jira
  orchestration", "set jira config", "update jira config", "change atlassian base url", "change
  cloud id", "change jira project key", or hits the missing-config pointer from
  /orchestrate-jira-issue, /create-jira-issue, or /create-pr. Loads the current values, lets the
  user fill in or update each one, and persists everything in a single write.
allowed-tools:
  - AskUserQuestion
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__set-config
---

# Configure Jira Orchestration

## Workflow

Follow these five steps in order.

### 1. Load current values

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config` with no arguments. Bind:
- `current.atlassianBaseUrl` ← `values.atlassianBaseUrl` (may be missing)
- `current.atlassianCloudId` ← `values.atlassianCloudId` (may be missing)
- `current.jiraProjectKey` ← `values.jiraProjectKey` (may be missing)

### 2. Show current state

Display in-chat:

```
Current Jira orchestration config:
  atlassianBaseUrl: <value or "(not set)">
  atlassianCloudId: <value or "(not set)">
  jiraProjectKey:   <value or "(not set)">
```

### 3. Collect new/updated values

Use a single `AskUserQuestion` round, one question per key grouped into one message:
- If a key is currently set: offer `Keep "<value>" (Recommended)` plus `Update`. The auto-`Other` choice covers freeform replacement input.
- If a key is currently unset: ask for it. The auto-`Other` choice provides the entry slot.

Trim whitespace from any user-supplied values.

**Always run this step end-to-end.** When all values are already set and the user invokes the skill purely to update, still load → show → ask → write. Do not short-circuit "all values set" with an early return — a "Keep all" round results in a redundant but harmless write.

### 4. Persist in a single write

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__set-config` once with all three keys:

```json
{ "values": { "atlassianBaseUrl": "<final>", "atlassianCloudId": "<final>", "jiraProjectKey": "<final>" } }
```

Passing all three keys is safe — `set-config` merges (preserves unspecified keys), so the call is harmless whether values changed or not.

### 5. Report back

Show the persisted values in-chat:

```
Saved Jira orchestration config:
  atlassianBaseUrl: <value>
  atlassianCloudId: <value>
  jiraProjectKey:   <value>
```
