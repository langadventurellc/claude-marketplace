# Task Trellis Marketplace

A Claude Code plugin marketplace for [Task Trellis](https://github.com/langadventurellc/task-trellis-mcp) — spec-driven, multi-agent coding workflows for solo developers.

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

- `technical-discovery` — read-only investigation of a problem or proposed change. Produces an impact-and-recommendations report instead of code. Run this *before* asking for issues; well-scoped specs come out the other side.
- `requirements-creation` — turns a vague change request into structured What / Where / Why / Done requirements through focused conversation.
- `create-implementation-plan` — generates a detailed `## Implementation Plan` block for a Trellis coding task, called by the issue-writer agent so the eventual developer can implement without re-deriving the approach.
- `docs-updater` — reviews a body of work (git ref range, ticket, or description) and updates README, CLAUDE.md, AGENTS.md, and `docs/` so they don't drift behind the code.

### Also in the marketplace

- **task-trellis** — the original subagent-based variant, predating Agent Teams. Stable but no longer the recommended path; use `task-trellis-teams` for new work.
- **mise** — runs lint/type-check after edits and quality checks before task completion, when [mise](https://mise.jdx.dev/) is configured.
- **git** — small workflow skills (e.g., `/git:commit`).

```
/plugin install task-trellis@task-trellis-marketplace
/plugin install mise@task-trellis-marketplace
/plugin install git@task-trellis-marketplace
```

## License

GNU General Public License v3.0
