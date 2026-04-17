---
name: commit
description: Commits staged and unstaged changes to git with a concise conventional commit message. Use when changes are ready to be committed, after completing a task, or when the user asks to commit.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Git Commit

Stage all changes and commit them with a concise conventional commit message.

## Input

$ARGUMENTS

## Instructions

### 1. Navigate to Repository Root

Before staging files, ensure you are at the repository root:

```bash
git rev-parse --show-toplevel
```

Change to this directory if not already there.

### 2. Stage All Changes

**Important**: Always run from the repository root to ensure all changes are included.

```bash
git add .
```

### 3. Review What Will Be Committed

Check the staged changes:

```bash
git diff --cached --stat
```

### 4. Create the Commit

Commit with a **concise** message following conventional commit guidelines.

**Format**: `type: description` (keep under 50 characters)

**Common types**:
- `feat`: new feature
- `fix`: bug fix
- `refactor`: code refactoring
- `docs`: documentation
- `style`: formatting/style
- `test`: tests
- `chore`: maintenance

**Style**:
- Use imperative mood ("Fix bug" not "Fixed bug")
- Capitalize first word
- No period at end
- Be specific but brief
- Focus on WHAT and WHY, not HOW

**Examples**:
- `feat: add user login validation`
- `fix: resolve memory leak in parser`
- `refactor: simplify authentication logic`

### 5. Handle Pre-Commit Hook Failures

If pre-commit hooks fail:

1. **Read the error output** to understand what failed
2. **Fix the underlying issues** - do not bypass hooks
3. **Stage the fixes**: `git add .`
4. **Commit again** with the same message

**NEVER** use `--no-verify` or force a commit without resolving issues.

### 6. Verify Success

After committing, verify the commit was created:

```bash
git log -1 --oneline
```

## Error Handling

- If there are no changes to commit, report this and exit gracefully
- If hooks fail repeatedly, stop and ask the user for guidance
- Never force commits or skip validation steps
