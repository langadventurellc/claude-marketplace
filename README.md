# Task Trellis Marketplace

A Claude Code plugin marketplace for [Task Trellis](https://github.com/langadventurellc/task-trellis-mcp) — spec-driven, multi-agent coding workflows for solo developers. Also includes `jira-issue-orchestration`, a mostly autonomous Jira → Trellis → PR pipeline.

## Installation

Add the marketplace:

```
/plugin marketplace add langadventurellc/claude-marketplace
```

Install the two core plugins:

```
/plugin install task-trellis-teams@task-trellis-marketplace
/plugin install planning@task-trellis-marketplace
```

`task-trellis-teams` requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in your environment. It also depends on the [Task Trellis MCP server](https://github.com/langadventurellc/task-trellis-mcp) — install that and add it to your MCP config before first run.

## What you get

### task-trellis-teams

Orchestrates issue creation and implementation through Claude Code's Agent Teams.

- `/create-trellis-issues` — writer + reviewer teammates draft and critique issues via direct messaging. Cross-sibling consistency pass uses a fresh reviewer to avoid bias. Conversation artifacts (designs, planning output, spec docs) are auto-attached to the relevant issue. Coding tasks get an inline implementation plan via `planning:create-implementation-plan` before creation.
- `/implement-trellis-issues` — walks the issue tree and spawns a fresh developer/reviewer pair per leaf task. Wave-based parallelism: all ready candidates run together; queue re-evaluates after each wave drains. Automatic coherence review after 3+ siblings complete. `--commit`, `--no-docs`, and `--version` flags hand back commit-ready output.
- `/open-ui` and a SessionStart hook surface the Task Trellis browser UI without being asked.

### planning

The skills that make the orchestration land cleanly. Useful on their own; depended on by `task-trellis-teams`.

- `discovery` — router-style read-only investigation skill. Classifies the request into a discovery type (technical-code, agentic-dev, tool-research, documentation, or general) and runs the matching playbook. Produces an impact-and-recommendations report instead of code. Run this *before* asking for issues; well-scoped specs come out the other side. Set `TT_DISCOVERY_PLAYBOOK` to a readable file path to swap the type router for your own playbook for the rest of the session.
- `requirements-creation` — turns a vague change request into structured What / Where / Why / Done requirements through focused conversation.
- `create-implementation-plan` — generates a detailed `## Implementation Plan` block for a Trellis coding task, called by the issue-writer agent so the eventual developer can implement without re-deriving the approach.
- `docs-updater` — reviews a body of work (git ref range, ticket, or description) and updates README, CLAUDE.md, AGENTS.md, and `docs/` so they don't drift behind the code.

### jira-issue-orchestration

Runs a single command to autonomously take a Jira issue all the way to an open draft PR.

- `/orchestrate-jira-issue <JIRA-ID>` — validates the issue, spawns a planning sub-session that investigates the ticket and creates Trellis tasks, then spawns an implementation sub-session that implements those tasks and opens a draft PR. Both sub-sessions communicate with the conductor over IPC log files managed by the `issue-orchestration` MCP server.
- `/investigate-jira-issue <JIRA-ID>` — standalone investigation step. Fetches the ticket, pulls linked context, then routes to `planning:requirements-creation` (underspecified) or `planning:discovery` (well-specified) to produce a requirements artifact.
- `/create-pr` — commit, push, and open a draft GitHub PR with Jira context auto-detected. Enforces `{JIRA-ID}: {outcome}` title format; halts on suspicious staged content. Set `TT_PR_TEMPLATE` to a readable file path to swap the default PR body template for your team's template for the rest of the session.

**Prerequisites:** `task-trellis-teams` must also be installed (it is a declared plugin dependency). The MCP server is bundled in the plugin and self-registers — no manual setup required. Requires Claude Code v2.1.98+, macOS + iTerm2 + tmux, and Node ≥ 22.

**First-run config:** Run `/orchestrate-jira-issue` once per project before using the standalone skills — it prompts for your Atlassian base URL, cloud ID, and Jira project key and persists them per-project via the `issue-orchestration` MCP server. `/investigate-jira-issue` and `/create-pr` require that config to already exist and will not prompt for missing values.

```
/plugin install jira-issue-orchestration@task-trellis-marketplace
```

### Also in the marketplace

- **mise** — runs lint/type-check after edits and quality checks before task completion, when [mise](https://mise.jdx.dev/) is configured.
- **git** — small workflow skills (e.g., `/git:commit`).

```
/plugin install mise@task-trellis-marketplace
/plugin install git@task-trellis-marketplace
```

## Local Development

### Prerequisites

Install [mise](https://mise.jdx.dev/) before working in this repo:

```bash
brew install mise   # macOS
```

For other platforms, see the [mise installation docs](https://mise.jdx.dev/getting-started.html).

> **Warning:** If you have the marketplace's `mise` plugin enabled but `mise` is not installed, post-edit and pre-complete-task hooks will fail with `mise: command not found`.

### Bootstrap

Run these commands in order after cloning:

```bash
mise install
npm install --prefix plugins/jira-issue-orchestration/mcp-server
mise run install-hooks
```

The `install-hooks` step points git at `.githooks/`, which contains a pre-commit hook that rebuilds `plugins/jira-issue-orchestration/mcp-server/bundle/server.js` whenever the MCP server source is staged and adds the rebuilt bundle to the same commit. The bundle is what the marketplace ships — `node_modules/` is not distributed.

### Available tasks

All tasks delegate to npm scripts in `plugins/jira-issue-orchestration/mcp-server/`:

| Task | Description |
|------|-------------|
| `mise run lint` | ESLint on `src/**/*.ts` in `mcp-server/` |
| `mise run type-check` | TypeScript type check (`tsc --noEmit`) in `mcp-server/` |
| `mise run quality` | Aggregates `lint` + `type-check` |
| `mise run test` | Vitest (`--passWithNoTests`) in `mcp-server/` |
| `mise run bundle` | esbuild-bundle the MCP server to `mcp-server/bundle/server.js` |
| `mise run install-hooks` | Point git at `.githooks/` so commit-time bundling runs |

### Marketplace mise plugin automation

If the marketplace's `mise` plugin is installed, these tasks run automatically:

- **`lint` and `type-check`** — after every `Edit`, `Write`, or `MultiEdit` tool call
- **`quality` and `test`** — before every `complete_task` MCP tool call

## License

GNU General Public License v3.0
