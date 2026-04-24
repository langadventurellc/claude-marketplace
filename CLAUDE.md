# Claude Marketplace

This repository is a **Claude Code Plugin Marketplace** that hosts and distributes plugins for Claude Code. It hosts the Task Trellis plugin family (`task-trellis-teams`, `mise`, `planning`, `git`) for hierarchical task management and related AI coding workflows, plus the `jira-issue-orchestration` plugin for mostly autonomous Jira-to-PR orchestration.

## Always Consult Current Documentation

Claude Code's plugin system — manifest schemas, skill frontmatter fields, hook events, marketplace sources, MCP/LSP configuration — evolves quickly. Your training data is stale by the time it's used. **Do not rely on memorized conventions.** Before any change to plugins, skills, agents, hooks, manifests, or marketplace entries in this repo, fetch the relevant docs and verify against the current spec.

Use `WebFetch` (or Perplexity when search is needed) to pull these pages on demand:

- [Plugins overview](https://code.claude.com/docs/en/plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) — manifest schemas, directory layout, required vs. optional fields
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — `marketplace.json` schema, source types
- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Skills](https://code.claude.com/docs/en/skills) — `SKILL.md` frontmatter, invocation, argument substitution
- [Hooks](https://code.claude.com/docs/en/hooks) — events, matchers, hook config format

### When to fetch

Fetch before (not after) you write or edit:

- Creating or editing any `plugin.json`, `marketplace.json`, `SKILL.md`, `hooks.json`, `.mcp.json`, or `.lsp.json`
- Adding a new plugin, skill, agent, or hook
- Changing directory layout within a plugin
- Writing install instructions or marketplace source entries
- Debugging behavior that depends on frontmatter fields, hook events, or tool naming

If the user's request touches any of the above and you haven't fetched in this session, fetch first. Cite the doc you used in your response so the user can verify.

## Repository Layout

```
claude-marketplace/
├── .claude-plugin/
│   └── marketplace.json    # Registers all plugins in this marketplace
├── plugins/
│   ├── task-trellis-teams/         # Agent Teams task management workflows
│   ├── jira-issue-orchestration/   # Jira → Trellis → PR autonomous orchestration
│   ├── mise/                       # mise task runner integration (hooks)
│   ├── planning/                   # Requirements + docs planning skills
│   └── git/                        # Git workflow skills
└── README.md
```

> **`jira-issue-orchestration` also requires the `issue-orchestration-mcp` Node server** (from the companion repo `claude-code-issue-orchestration`). Build it and register it in your Claude Code MCP settings before using the plugin. See the README for full setup instructions.

## User Installation

```
/plugin marketplace add langadventurellc/claude-marketplace
/plugin install task-trellis-teams@task-trellis-marketplace
```

## Local Development

Test a plugin locally:

```bash
claude --plugin-dir ./plugins/task-trellis-teams
```

Validate the marketplace or a plugin:

```bash
claude plugin validate .
```
