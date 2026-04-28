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
├── mise.toml                       # Pins Node 22; defines lint/type-check/test/quality tasks
└── README.md
```

> **`jira-issue-orchestration`** bundles its `issue-orchestration-mcp` MCP server inside the plugin — no companion repo or manual MCP registration required. Install the plugin and it self-registers.

## Skill Override Pattern (`TT_*` env vars)

Skills in this marketplace can expose a per-install override hook by replacing a swappable section of `SKILL.md` with a [dynamic-context-injection block](https://code.claude.com/docs/en/skills#inject-dynamic-context) that calls a bundled script. The script reads an env var; if set and pointing to a readable file, it emits that file's contents (wrapped in a "follow this verbatim" frame) — otherwise it `cat`s a sibling default doc. Canonical example: `plugins/planning/skills/discovery/` (script + `default-router.md` + injection block in `SKILL.md`).

Env var naming: **`TT_{NAME}`**. The `TT_` prefix namespaces all override knobs in this marketplace to the Task Trellis family (e.g. `TT_DISCOVERY_PLAYBOOK`). Use it for any future override variable.

## Versioning: plugin markdown is code, not docs

Files under `plugins/*/skills/`, `plugins/*/agents/`, `plugins/*/commands/`, `plugins/*/hooks/`, and `plugins/*/.claude-plugin/` are **runtime code**, not documentation. They define what the plugin does at runtime — adding one is shipping a new entry point, not writing about one.

Apply SemVer accordingly to the affected plugin's `plugin.json`:

- **Minor bump** — adding a new skill, agent, command, hook, or MCP tool. New entry point = new feature.
- **Major bump** — removing or breaking-changing an existing skill/agent/command/hook (renaming, changing required args, removing tool calls callers depend on).
- **Patch bump** — tweaking wording, fixing a typo, refining instructions inside an existing skill/agent/command/hook without changing its surface.
- **README.md / CLAUDE.md / other prose docs** — these are real documentation; edits to them do not require a version bump.

**Default to invoking `planning:versioning` rather than picking a number by hand** — it's project-type aware and already encodes the rule above. Hand-picking versions tends to anchor on the last commit's bump level instead of classifying the actual change.

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

### mise setup (required for hooks)

The marketplace's `mise` plugin runs quality checks automatically via hooks. `mise` must be installed and bootstrapped or those hooks will fail with `mise: command not found`.

Bootstrap once after cloning:

```bash
mise install
npm install --prefix plugins/jira-issue-orchestration/mcp-server
```

Available tasks (run from repo root): `mise run lint`, `mise run type-check`, `mise run quality`, `mise run test`. See README.md "Local Development" for full details.
