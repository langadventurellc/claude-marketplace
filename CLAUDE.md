# Claude Marketplace

This repository is a **Claude Code Plugin Marketplace** that hosts and distributes plugins for Claude Code. It currently contains the Task Trellis plugin for hierarchical task management.

## Documentation References

- [Plugin Documentation](https://code.claude.com/docs/en/plugins)
- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Skills Documentation](https://code.claude.com/docs/en/skills)
- [Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Discover and Install Plugins](https://code.claude.com/docs/en/discover-plugins)
- [Plugins Reference](https://code.claude.com/docs/en/plugins-reference)

---

## Claude Code Concepts Summary

### What is a Plugin?

A **plugin** is a packaged extension for Claude Code that can contain:
- **Skills** - Instructions that extend Claude's capabilities (invoked via `/plugin-name:skill-name`)
- **Agents** - Custom subagent definitions for delegating tasks
- **Hooks** - Event handlers that run before/after tool usage
- **MCP Servers** - External tool integrations via Model Context Protocol
- **LSP Servers** - Language Server Protocol for code intelligence

### Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json       # Required: Plugin manifest (name, version, description)
├── skills/               # Skills with SKILL.md files
│   └── my-skill/
│       └── SKILL.md
├── commands/             # Alternative: Skills as individual .md files
├── agents/               # Custom agent definitions
├── hooks/
│   └── hooks.json        # Event handlers
├── .mcp.json             # MCP server configurations
└── .lsp.json             # LSP server configurations
```

**Important**: Only `plugin.json` goes inside `.claude-plugin/`. All other directories are at the plugin root.

### Plugin Manifest (`plugin.json`)

Required fields:
- `name` - Unique identifier and skill namespace
- `version` - Semantic versioning (e.g., "1.0.0")
- `description` - What the plugin does

Optional fields: `author`, `homepage`, `repository`, `license`, `keywords`

---

### What is a Marketplace?

A **marketplace** is a catalog that distributes plugins to users. It provides:
- Centralized discovery of plugins
- Version tracking and automatic updates
- Support for multiple source types (git repos, local paths)

### Marketplace Structure

```
my-marketplace/
├── .claude-plugin/
│   └── marketplace.json  # Required: Marketplace manifest
└── plugins/
    └── my-plugin/        # Plugin directories
```

### Marketplace Manifest (`marketplace.json`)

Required fields:
- `name` - Marketplace identifier (kebab-case)
- `owner` - Object with `name` (and optional `email`)
- `plugins` - Array of plugin entries

Each plugin entry needs:
- `name` - Plugin identifier
- `source` - Where to fetch it (relative path, GitHub, or git URL)

Optional plugin fields: `description`, `version`, `category`, `tags`

### Plugin Sources

```json
// Relative path (for plugins in same repo)
{ "source": "./plugins/my-plugin" }

// GitHub repository
{ "source": { "source": "github", "repo": "owner/repo" } }

// Git URL
{ "source": { "source": "url", "url": "https://gitlab.com/team/plugin.git" } }
```

---

### What is a Skill?

A **skill** extends what Claude can do. Create a `SKILL.md` file with instructions, and Claude adds it to its toolkit. Skills can be:
- **User-invoked** - Triggered manually with `/skill-name`
- **Model-invoked** - Claude uses them automatically when relevant

### Skill Structure (`SKILL.md`)

```yaml
---
name: my-skill
description: What this skill does and when to use it
disable-model-invocation: true  # Optional: prevent auto-invocation
allowed-tools: Read, Grep       # Optional: restrict tools
context: fork                   # Optional: run in subagent
---

Your skill instructions here...
```

### Key Frontmatter Fields

| Field | Description |
|-------|-------------|
| `name` | Display name (defaults to directory name) |
| `description` | When Claude should use this skill |
| `disable-model-invocation` | Set `true` to only allow manual `/skill` invocation |
| `user-invocable` | Set `false` to hide from `/` menu (model-only) |
| `allowed-tools` | Comma-separated list of allowed tools |
| `context` | Set to `fork` to run in isolated subagent |
| `agent` | Which subagent type when `context: fork` |

### Skill Argument Substitution

- `$ARGUMENTS` - All arguments passed to the skill
- `$ARGUMENTS[N]` or `$N` - Specific argument by index
- `${CLAUDE_SESSION_ID}` - Current session ID
- `` !`command` `` - Shell command output (preprocessed)

### Skill Locations (Priority Order)

1. Enterprise (managed settings)
2. Personal (`~/.claude/skills/`)
3. Project (`.claude/skills/`)
4. Plugin (`<plugin>/skills/`)

---

### What are Hooks?

**Hooks** are event handlers that run shell commands in response to Claude Code events. They can run before or after tool usage.

### Hook Events

- `PreToolUse` - Before a tool runs
- `PostToolUse` - After a tool runs
- `Notification` - When Claude sends notifications
- `Stop` - When Claude stops working

### Hook Configuration (`hooks.json`)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint:fix $FILE"
          }
        ]
      }
    ]
  }
}
```

---

## This Repository Structure

```
claude-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest
├── plugins/
│   └── task-trellis/             # Task Trellis plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── agents/               # Subagent type definitions
│       ├── skills/               # Plugin skills
│       ├── hooks/
│       │   └── hooks.json
│       └── .mcp.json
└── README.md
```

## User Installation

Users install from this marketplace with:

```
/plugin marketplace add langadventurellc/claude-marketplace
/plugin install task-trellis@task-trellis-marketplace
```

## Development

### Testing Plugins Locally

```bash
claude --plugin-dir ./plugins/task-trellis
```

### Validating Marketplace/Plugin

```bash
claude plugin validate .
```

Or from within Claude Code:
```
/plugin validate .
```

## Contributing

When adding new plugins or skills:
1. Follow the directory structure conventions
2. Include required manifest fields
3. Write clear skill descriptions so Claude knows when to use them
4. Test locally with `--plugin-dir` before committing
