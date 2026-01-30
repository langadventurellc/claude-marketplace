# Mise Plugin

A Claude Code plugin that integrates [mise](https://mise.jdx.dev/) task runner with Task Trellis for quality validation during AI coding workflows.

## What It Does

This plugin provides hooks that automatically run quality checks when Claude Code edits files or completes Task Trellis tasks. It only activates in projects that have mise configured.

## Hooks

### Post-Edit Hook

Runs after `Edit`, `MultiEdit`, or `Write` tool calls:

1. Detects if the project uses mise (checks for `.mise.toml`, `mise.toml`, or `.tool-versions`)
2. Runs `mise run lint` to check for linting issues
3. Runs `mise run type-check` to verify type safety
4. Reports any failures so Claude can address them immediately

### Pre-Complete Task Hook

Runs before the `complete_task` MCP tool call:

1. Detects if the project uses mise
2. Runs `mise run quality` for comprehensive quality checks
3. Runs `mise run test` to verify tests pass
4. Blocks task completion if checks fail

## Requirements

- Projects must have mise configured with the following tasks defined:
  - `lint` - Linting checks (used after edits)
  - `type-check` - Type checking (used after edits)
  - `quality` - Quality checks (used before task completion)
  - `test` - Test suite (used before task completion)

## Installation

```
/plugin install mise@task-trellis-marketplace
```

## License

MIT
