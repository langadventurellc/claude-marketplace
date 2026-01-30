# Git Plugin

A Claude Code plugin that provides git workflow skills for AI coding agents.

## Skills

### `/git:commit`

Stages all changes and commits them with a concise conventional commit message.

**Features**:
- Automatically stages all changes from the repository root
- Generates conventional commit messages (`type: description`)
- Handles pre-commit hook failures by fixing issues rather than bypassing
- Works with Task Trellis orchestration workflows

**Usage**:
```
/git:commit
```

Or invoke programmatically when implementing tasks - the skill is both user and model invocable.

## Integration with Task Trellis

This plugin is designed to work with the Task Trellis plugin. The `issue-implementation` orchestration workflow uses the commit skill when committing task changes, ensuring consistent commit practices across automated workflows.

## Installation

```
/plugin install git@task-trellis-marketplace
```

## License

MIT
