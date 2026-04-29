---
name: create-jira-issue
description: Creates a Jira issue in the project's configured Jira instance from a free-form description. Use when the user says "create a Jira ticket", "file a Jira issue", "open a Jira ticket", "log a bug in Jira", "make a new Jira ticket", or "report this in Jira". Drafts an outcome-focused summary and a structured description, humanizes the prose sections, shows the draft, and waits for explicit user confirmation before submitting.
allowed-tools:
  - AskUserQuestion
  - Skill
  - mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config
  - mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata
  - mcp__plugin_atlassian_atlassian__getJiraIssueTypeMetaWithFields
  - mcp__plugin_atlassian_atlassian__createJiraIssue
---

# Create Jira Issue

## Configuration

Tenancy values (Jira project key, Atlassian base URL, Atlassian cloud ID) are loaded via the `issue-orchestration` MCP server's `get-config` tool in step 0. Jira URL format is `<BASE_URL>/browse/<KEY>`.

## Workflow

Follow these steps in order. Each step's output is required for the next.

### 0. Preflight: load configuration

Call `mcp__plugin_jira-issue-orchestration_issue-orchestration__get-config` with no arguments. Bind `BASE_URL` ← `values.atlassianBaseUrl`, `PROJECT_KEY` ← `values.jiraProjectKey`, `CLOUD_ID` ← `values.atlassianCloudId`. If any are missing or empty, stop: `Config missing or incomplete. Run /orchestrate-jira-issue first to set up configuration.`

### 1. Gather input

Required: a free-form description of what the issue is about — what's broken, what needs to be built, what change is wanted.

Source the description in this order:

1. If the skill was invoked with explicit instructions/payload, use that.
2. Otherwise, derive it from the current conversation — the issue the user has been discussing, the bug just diagnosed, the feature just scoped. The conversation *is* the input; do not pre-confirm.
3. Only if there are no instructions and no conversation context to draw from, ask once via `AskUserQuestion` for the description before doing anything else.

Do not ask which Jira project to use. The project is fixed by `PROJECT_KEY` from step 0.

### 2. Resolve the issue type

Call `mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata` with `cloudId=CLOUD_ID` and `projectIdOrKey=PROJECT_KEY` to enumerate available issue types.

Default silently to `Task` if available, otherwise the first available non-Epic, non-Subtask type. Do not probe the input for type-specific language — the template below is general-purpose and applies regardless of type. If the user explicitly named a type in their request (e.g. "file a Bug for..."), honor it.

### 3. Draft the summary and description

Produce a `summary` string and a `description` string per the instructions below. Step 4 displays them; step 5 submits them.

```!
bash "${CLAUDE_PLUGIN_ROOT}/scripts/load-template.sh" "${CLAUDE_SKILL_DIR}/default-template.md"
```

### 4. Show the draft and confirm

Print the full draft so the user sees exactly what will ship:

```
**Project:** <PROJECT_KEY>
**Type:** <issueTypeName>
**Summary:** <summary>

**Description:**
<full description verbatim>
```

Then ask via `AskUserQuestion`:

- Question: `Create this Jira issue?`
- Options:
  1. `Create now (Recommended)` — proceed to step 5.
  2. `Edit summary or description` — ask the user what to change, apply the edits in-chat, re-show the draft, ask again.
  3. `Cancel` — stop without creating.

**Do not call `createJiraIssue` until the user picks `Create now`.** Jira issue creation is non-reversible from this skill — there is no undo.

### 5. Create the issue

Call `mcp__plugin_atlassian_atlassian__createJiraIssue` with:

- `cloudId` = `CLOUD_ID`
- `projectKey` = `PROJECT_KEY`
- `issueTypeName` = the type chosen in step 2
- `summary` = the summary from step 3
- `description` = the description from step 3

Do not pass a `priority` field unless the user's input explicitly named one (`"P0"`, `"critical"`, `"blocker"`, `"high priority"`, etc.). Let Jira apply the project default otherwise.

#### Required-field fallback

If `createJiraIssue` fails with a missing-required-field error:

1. Call `mcp__plugin_atlassian_atlassian__getJiraIssueTypeMetaWithFields` with `cloudId=CLOUD_ID`, `projectIdOrKey=PROJECT_KEY`, and the issue type ID for the chosen type.
2. Identify the required fields the create call was missing.
3. Ask the user via a single `AskUserQuestion` round (one question per missing field; group into one message).
4. Retry `createJiraIssue` once with `additional_fields` populated. If it fails again, surface the error verbatim and stop.

### 6. Report back

Four lines, nothing more:

```
Created <KEY> <BASE_URL>/browse/<KEY>
Type: <issueTypeName>
Summary: <summary>
Project: <PROJECT_KEY>
```

Do not echo the description back — the user can click the URL.

## Notes on behavior

- **Do not search for duplicates.** This skill creates. Adding a search step here is scope creep.
- **Do not ask which project.** `PROJECT_KEY` is bound at config time and is the same for the whole working directory.
- **Respect overrides.** If the user says "skip the confirm, just create it" or "use this summary: ...", honor it.
- **One issue per invocation** unless the user explicitly asks for multiple.
