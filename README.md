# Task Trellis Marketplace

A Claude Code plugin marketplace for [Task Trellis](https://github.com/langadventurellc/task-trellis-mcp) - hierarchical task management for AI coding agents.

## Installation

Add the marketplace to Claude Code:

```
/plugin marketplace add langadventurellc/claude-marketplace
```

Install the Task Trellis plugin:

```
/plugin install task-trellis@task-trellis-marketplace
```

## Available Plugins

### task-trellis

Hierarchical task management for AI coding agents. Provides skills and hooks for managing projects, epics, features, and tasks through the Task Trellis MCP server.

**Features:**
- Project creation and management workflows
- Epic and feature breakdown skills
- Task implementation guidance

### mise

Integrates [mise](https://mise.jdx.dev/) task runner with Task Trellis for automatic quality validation during AI coding workflows.

**Features:**
- Runs lint and type-check after file edits
- Runs quality checks and tests before task completion
- Only activates in projects with mise configured

```
/plugin install mise@task-trellis-marketplace
```

### task-trellis-teams

Agent Teams-based variant of Task Trellis issue creation and implementation. Uses Claude Code's experimental Agent Teams so a writer and reviewer (or developer and reviewer) coordinate directly via `SendMessage` instead of routing through the lead session.

**Features:**
- `/create-trellis-issues` — writer + persistent reviewer teammates with direct-message fix loops; cross-sibling consistency pass (3+ siblings) uses a fresh reviewer to avoid bias
- `/implement-trellis-issues` — fresh developer/reviewer pair per leaf task; automatic cross-task coherence review after 3+ sibling tasks complete; optional `--commit` and `--docs` flags

Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

```
/plugin install task-trellis-teams@task-trellis-marketplace
```

### planning

Planning skills for scoping work, capturing requirements, and keeping documentation in sync with the code. Useful on its own, and a dependency of `task-trellis` / `task-trellis-teams` for their docs-update step.

**Features:**
- `requirements-creation` — turns vague change requests into structured What / Where / Why / Done requirements through focused conversation
- `technical-discovery` — read-only investigation of a problem or proposed change, producing an impact and recommendations report without writing code
- `docs-updater` — reviews a body of work (git ref range, ticket, or description) and updates README, CLAUDE.md, AGENTS.md, and `docs/` to prevent drift
- `planning-author` agent that handles documentation authoring on behalf of a caller

```
/plugin install planning@task-trellis-marketplace
```

## License

GNU General Public License v3.0
