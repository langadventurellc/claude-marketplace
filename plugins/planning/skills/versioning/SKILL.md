---
name: versioning
description: Bumps version files (package.json, plugin.json, pyproject.toml, Cargo.toml, VERSION, etc.) based on a diff. Project-type aware — Claude Code plugin markdown under agents/, skills/, commands/, hooks/, and .claude-plugin/ is treated as runtime configuration, not prose docs. Use when the user invokes /planning:versioning or when an orchestrator calls this skill at the end of an implementation run. Requires an explicit bump level or --infer — empty input is an error.
argument-hint: major|minor|patch|--infer
allowed-tools:
  - Glob
  - Read
  - Edit
  - Bash
---

# Versioning

Apply a version bump to the version files whose diff scope actually changed. The skill is project-type aware: in a Claude Code plugin repo, `.md` files under `agents/`, `skills/`, `commands/`, `hooks/`, and `.claude-plugin/` are runtime configuration (the plugin reads them on every invocation), not prose documentation. In a conventional code repo, `.md` files are typically prose and bump rules differ. See `reference/semver-guide.md` for the level-selection rules.

## Inputs

Invoked via `$ARGUMENTS`:

| Form | Meaning |
|---|---|
| `major` / `minor` / `patch` | Bump at the specified level. |
| `--infer` (or `infer`) | Read the diff and pick the level per `reference/semver-guide.md`. |
| `--version <level>` | Equivalent to `<level>`. Accepted for compatibility with orchestrators that forward a `--version` flag. |
| `--version` (no value) | Equivalent to `--infer`. |
| *(empty)* | Error — print usage and stop without touching any files. |

**Explicit opt-in required.** Empty `$ARGUMENTS` is an error. The skill never bumps "by default" — the caller must say what they want, or explicitly ask for inference.

## Process

### 1. Parse input

- Strip a leading `--version` token if present.
- If the remainder is `major`, `minor`, or `patch`, set mode = `explicit` with that level.
- If the remainder is `--infer` or `infer` (or was `--version` with no value), set mode = `infer`.
- If `$ARGUMENTS` was empty, print the usage block under §7 (No input) and stop. Do not continue to §2.

### 2. Establish the diff

Determine the base branch and capture the change set:

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

Fall back to `main`, then `master` if the symbolic-ref command fails.

Then:

```bash
git diff --stat <base>...HEAD
git diff --name-only <base>...HEAD
git status --short
```

Merge the committed diff with any uncommitted working-tree changes — both contribute to the scope. If the working tree is clean AND `<base>...HEAD` is empty, report "no changes in scope" and stop without editing.

### 3. Detect project type

Probe the repo root for indicators. Record every indicator present; multiple can coexist in a monorepo.

| Indicator | Implication for this skill |
|---|---|
| `.claude-plugin/marketplace.json` at the repo root | Claude Code plugin marketplace. Files under `plugins/*/agents/`, `plugins/*/skills/`, `plugins/*/commands/`, `plugins/*/hooks/`, and `plugins/*/.claude-plugin/` are runtime config. |
| `.claude-plugin/plugin.json` (at any depth) | That directory is a Claude Code plugin. Files under its `agents/`, `skills/`, `commands/`, `hooks/` are runtime config. |
| `package.json` | Node/JS package. `.md` files are typically prose. |
| `pyproject.toml` / `setup.cfg` | Python package. `.md` files are typically prose. |
| `Cargo.toml` | Rust crate. `.md` files are typically prose. |
| `VERSION` | Plain-text version file at that directory. |

Use `Glob` with patterns like `.claude-plugin/plugin.json`, `**/.claude-plugin/plugin.json`, `package.json`, `**/package.json` to find indicators quickly. Resolve per-diff-scope: the indicator(s) that apply to a given changed file are the ones closest to it walking upward.

### 4. Discover version files in scope

For each changed file from §2, walk upward from the file's directory until you reach a version file. Collect the unique set of version files to bump.

Version-file priority at any directory level (stop at the first match):

1. `.claude-plugin/plugin.json` (`"version"` field) — plugin directories.
2. `package.json` (`"version"` field).
3. `pyproject.toml` (`version = "..."` under `[project]` or `[tool.poetry]`).
4. `Cargo.toml` (`version = "..."` under `[package]`).
5. `VERSION` (plain text).
6. `version.py` / `__version__.py` / `setup.cfg`.
7. `gradle.properties`.

**Monorepo scoping:** Bump only version files corresponding to packages whose diff scope changed. Never cascade to sibling packages. If the repo root has `.claude-plugin/marketplace.json` and a changed file lives outside any individual plugin directory (e.g., top-level README, root `CLAUDE.md`), consult the marketplace file only if it declares a `"version"` field; otherwise skip it.

**No version file in scope:** If the diff scope touches only files that cannot be associated with a version file (e.g., root-only docs in a repo with no root `VERSION`/`package.json`), report the condition and stop. Do not invent a version file.

### 5. Pick the bump level

**Mode = `explicit`:** use the supplied level. Skip to §6.

**Mode = `infer`:** consult `reference/semver-guide.md` using the project-type context from §3.

- **Project policy first.** Before applying the guide's generic rules, look for `VERSIONING.md`, a versioning section in `CONTRIBUTING.md`, or explicit guidance in `CLAUDE.md` / `AGENTS.md`. If found, follow it.
- For each changed file, classify it:
  - Claude Code plugin repo + file under `agents/`, `skills/`, `commands/`, `hooks/`, `.claude-plugin/` → runtime config (never doc-only for versioning).
  - Conventional repo + `.md` file → typically prose.
  - Source code file → apply baseline semver rules.
- Pick the highest level indicated across all changed files (major > minor > patch).
- Respect pre-1.0 caveats (see guide).

### 6. Apply the bump

For each version file identified in §4:

- Read the current version string.
- Compute the new version per the chosen level.
- Apply the bump with `Edit`.

**Mandatory-bump invariant.** If the skill reached this step, a bump must occur. "No bump" is never a valid outcome of §5 or §6. If a change is genuinely trivial (whitespace, comment-only), the level is `patch`. The only no-bump outcomes are:

- §1 (empty input) — usage printed, no edits.
- §2 (no changes in diff scope) — report and stop.
- §4 (no version file in scope) — report and stop.

### 7. Report

After successful bumps:

```
## Version Bumps

- `path/to/version-file`: `<old>` → `<new>` (<level>)

### Summary
<1-2 sentences: which packages were affected, what level, and why.>

### Notes
<Optional — project-type detection outcome, monorepo scoping decisions, or open questions. Omit if none.>
```

When the input was empty (**No input**):

```
## Versioning: usage

No level provided. Invoke as one of:

- `/planning:versioning major`
- `/planning:versioning minor`
- `/planning:versioning patch`
- `/planning:versioning --infer`

No version files were modified.
```

When no changes are in scope, or no version file was found in the scope:

```
## Version Bumps

No version files bumped.

### Reason
<one of: "No changes in diff scope" | "No version file found in the diff scope">

### Files in scope
<list — empty if no changes>
```

## Guidelines

- **No commits.** This skill never runs `git commit` or touches remotes. The caller owns committing.
- **Project policy wins.** A `VERSIONING.md` or equivalent in the repo overrides the generic semver rules.
