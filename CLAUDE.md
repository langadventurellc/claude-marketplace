<!-- BEGIN TEMPORARY: first-run learning capture for jira-issue-orchestration. Added 2026-04-24. Remove this whole block (down to END TEMPORARY) once learnings are harvested. -->

## Observation Report Protocol (TEMPORARY — first-run learning capture)

The `jira-issue-orchestration` plugin is brand new and being exercised for the first time. To capture learnings across every Claude Code instance and subagent involved, **every agent participating in an orchestration run MUST file a short observation report as its final action before reporting completion.**

This applies to: the top-level conductor session, the planning sub-session, the implementation sub-session, and every subagent spawned inside them (Trellis issue-writer/issue-reviewer, Trellis developer/implementation-reviewer, etc.). If you are reading this file as part of an `orchestrate-jira-issue` run in any role, this protocol applies to you.

### How to file a report

1. Just before declaring your task complete (or just before sending the `done` IPC signal, if you are a sub-session), write a single markdown file to:

   ```
   .orchestration-learnings/<YYYY-MM-DD>/<unix-ts>-<role-slug>-<rand6>.md
   ```

   - `<YYYY-MM-DD>` — today's date (UTC is fine).
   - `<unix-ts>` — `date +%s` output.
   - `<role-slug>` — short identifier of your role, e.g. `top-conductor`, `planning-sub`, `impl-sub`, `trellis-issue-writer`, `trellis-issue-reviewer`, `trellis-developer`, `trellis-impl-reviewer`. Append a task identifier if you have one.
   - `<rand6>` — six random hex chars (e.g. from `openssl rand -hex 3`) to avoid collisions between parallel subagents.

   Use `mkdir -p` for the directory and the `Write` tool for the file.

2. Use exactly this template, and keep the whole file under ~250 words:

   ```markdown
   # Observation Report — <role-slug>

   ## Role / context
   <One sentence: what role you played and what task you were given.>

   ## What went well
   <Bullets. What was clear, what tools worked, what instructions were easy to follow.>

   ## What didn't
   <Bullets. Friction, confusion, dead-ends, retries.>

   ## Errors or surprises
   <Bullets. Tool errors, unexpected outputs, behavior that contradicted instructions.>

   ## Recommendations / instruction-clarity gaps
   <Bullets. Concrete suggestions: wording to fix, missing guidance, contracts that should be tightened.>
   ```

### Rules

- **Do not read other reports.** Each agent's report is independent.
- **Do not include secrets, tokens, or large code dumps.** Reference file paths or short quotes only.
- **Single-line IPC messages remain single-line.** Filing a report is a local file write — it does not change any IPC protocol.
- **Report once per agent per run.** If you are a long-running subagent that completes multiple tasks, file one report at the very end.
- This directory is gitignored — reports are local to the developer's machine.

<!-- END TEMPORARY -->

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
