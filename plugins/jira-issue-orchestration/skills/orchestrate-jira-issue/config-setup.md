# Configuration Setup

## 1. Resolve CONFIG_PATH

Run `Bash`:

```
mkdir -p ~/.claude/jira-issue-orchestration && echo ~/.claude/jira-issue-orchestration/_config.json
```

Bind the printed path to `CONFIG_PATH` for the rest of this run.

## 2. Required keys

| Key | Description |
|---|---|
| `atlassianBaseUrl` | Base URL for Atlassian (e.g. `https://acmecorp.atlassian.net`) |
| `atlassianCloudId` | Atlassian Cloud ID (UUID) used for Jira API calls |
| `jiraProjectKey` | Jira project key prefix (e.g. `ACME`) |

## 3. Load, gap-fill, and persist

1. Use `Read` on `CONFIG_PATH`.
2. For each required key listed above that is missing or empty, use `AskUserQuestion` to collect it from the user.
3. Use `Write` to persist the merged config back to `CONFIG_PATH`. **Preserve any keys already present** — merge, don't overwrite.
4. Bind the resolved values for use in subsequent phases.
