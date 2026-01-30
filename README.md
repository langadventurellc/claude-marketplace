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

## License

GNU General Public License v3.0
