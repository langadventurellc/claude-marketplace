---
name: docs-updater
description: Reviews completed work and updates project documentation (README, CLAUDE.md, AGENTS.md, docs/) to prevent stale docs. Use after finishing a body of work — when the user says "update docs", "docs are probably stale", "keep docs in sync", or after completing a feature, ticket, or branch. Accepts a work-item reference, a freeform description of what changed, or a git ref range; defaults to diffing the current branch against the default branch.
allowed-tools:
  - Glob
  - Grep
  - Read
  - Edit
  - Write
  - Bash
  - WebFetch
  - WebSearch
---

# Documentation Updater

Keep project documentation in sync with the code. Invoked after a body of work is finished — by a user running the slash command, or by another agent at the end of a workflow. The primary goal is to prevent documentation drift: new behavior left undocumented, removed behavior still documented, or prose that contradicts the current code.

## Inputs

All inputs are optional — any combination is accepted:

- **Work-item reference** — an ID, URL, or title from the project's ticket system (Trellis, Jira, Linear, GitHub Issues, etc.). Resolve it if a tool for that system is available; otherwise treat it as an identifier to quote in the summary.
- **Description** — freeform text describing what was done.
- **Git ref range** — e.g., `main...HEAD`, `v1.2.0..HEAD`, a specific commit. Used for the authoritative diff.
- **Version bump** — `--version [major|minor|patch]` (optional). When present without a value, the skill infers the appropriate bump level from the diff per the semver rules in `reference/semver-guide.md`. When present with a value, the specified level is used. Accept alongside any combination of the other inputs.

**If no input is supplied**, default to `git diff <default-branch>...HEAD`. Detect the default branch via `git symbolic-ref refs/remotes/origin/HEAD`, then fall back to `main`, then `master`.

## Process

### 1. Establish what changed

Build a concrete picture of the change before touching any docs:

- If given a git ref range (or using the default), run `git diff <range>` and `git diff --stat <range>` to see scope.
- If given a work-item reference, read its description and any linked implementation notes (use the appropriate tool if one is available; otherwise fetch the URL or ask the caller for context).
- If given a freeform description, treat it as intent, and still run the git diff to verify what actually landed.
- When description and code disagree, the code is truth.

Compile a short list of what changed: new behavior, removed behavior, renamed/moved things, changed APIs/config/flags, new or removed dependencies.

### 2. Decide whether docs are affected

Documentation updates are needed only when code changes affect what a reader of the docs would need to know. Update when you see:

- New user-facing features or capabilities
- Removed or deprecated features
- Changed public APIs, CLIs, endpoints, or configuration
- New or changed setup, install, or build steps
- New or changed conventions that agents or contributors should follow
- Prose that no longer matches the code

**Skip** pure refactors, internal renames, formatting, test-only changes, and fixes that don't alter documented behavior. If nothing in the change touches documented surface area, report "no updates needed" and stop.

### 2.5. Version file discovery (when `--version` is set)

If `--version` was not passed, skip this section entirely.

Identify version files in the repo that correspond to the diff scope. Check in this priority order using `Glob` and `Read`:

1. `package.json` — look for a `"version"` field.
2. `pyproject.toml` — look for `version = "..."` under `[project]` or `[tool.poetry]`.
3. `Cargo.toml` — look for `version = "..."` under `[package]`.
4. `VERSION` — a plain-text version file at the repo root.
5. `plugin.json` files under `.claude-plugin/` directories — look for a `"version"` field.
6. Other common patterns: `version.py`, `__version__.py`, `setup.cfg`, `gradle.properties`.

**Monorepo rule**: Only bump version files that correspond to the packages or plugins the diff actually touches. Do NOT bump every version file in the repo when only one plugin or package changed. Use `git diff --stat` output to determine which directory the changes are concentrated in, then match that to the nearest version file.

**Project-specific rules override defaults**: Before applying any bump, look for project-level versioning policy — a `VERSIONING.md`, a versioning section in `CONTRIBUTING.md`, or explicit guidance in `CLAUDE.md`/`AGENTS.md`. If found, follow it instead of the generic semver rules in `reference/semver-guide.md`.

Collect the list of version files to bump; carry it into §4.

### 3. Discover documentation targets

In priority order:

1. **Well-known root files**: `README.md`, `CLAUDE.md`, `AGENTS.md`.
2. **Project-declared docs home**: read the files above for pointers like "docs live in `docs/`" or "see `website/content/`".
3. **Common docs directories** if not pointed to by a file above: `docs/`, `documentation/`, `website/`, `wiki/` at the repo root.

Treat `CLAUDE.md` and `AGENTS.md` as peers — updates to one usually need mirroring in the other. If only one exists, do not create the other; respect the project's choice.

`CHANGELOG.md` is out of scope for this skill. Leave release-note generation to a dedicated tool.

### 4. Make the updates

For each file that needs changes:

- Read the file first to match its tone, structure, and level of detail.
- Make targeted edits — touch only what the change affects.
- When editing `CLAUDE.md` or `AGENTS.md`, consult `reference/agent-instructions-guide.md` for authoring conventions.
- Do not add placeholders, TODOs, or "this section may need expansion" notes.
- Do not create new documentation files unless an existing file cannot reasonably host the content and the project has a pattern for adding one (e.g., a `docs/` directory with ADRs).
- **If `--version` was passed**: For each version file identified in §2.5, read the current version string, compute the new version per `reference/semver-guide.md` (or per project policy if found), and apply the bump using `Edit`. Include bumped version files in the "Files Updated" output below. Consult `reference/semver-guide.md` for the bump decision rules.

### 5. Report

After edits, produce a summary in this format:

```
## Documentation Updates

### Files Updated
- `path/to/file.md`: <one-line description of what changed and why>

### Version Bumps
*(Omit this section when `--version` was not passed.)*
- `path/to/version-file`: `<old-version>` → `<new-version>` (<bump-level> bump)

### Summary
<2-3 sentences: what changed in the code, what doc surface it affected, what was updated>

### Notes
<Optional: anything the caller should double-check, or questions that couldn't be answered from the diff alone. Omit if none.>
```

If no updates were needed:

```
## Documentation Updates

No updates needed.

### Analysis
<1-2 sentences: the change was scoped to <refactor/internal/tests/etc.> and did not affect documented behavior.>

### Files Reviewed
- <list of doc files checked>
```

## Guidelines

- **Evidence-based**: base updates on the diff, not on what you think the change might have done.
- **Minimal edits**: touch only the sections directly affected.
- **Style match**: preserve the file's voice, heading depth, and code-block conventions.
- **Don't bloat agent-instruction files**: `CLAUDE.md` and `AGENTS.md` should stay actionable. Link to deeper docs instead of inlining.
- **One change at a time**: if the diff contains multiple unrelated changes, handle each in order and report them as distinct entries.
