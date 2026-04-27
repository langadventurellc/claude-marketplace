---
name: docs-updater
description: Reviews completed work and updates project documentation (README, CLAUDE.md, AGENTS.md, docs/) to prevent stale docs. Invoked at the end of an implementation workflow with a base ref; diffs the working tree against that base to capture every change on the branch — committed and uncommitted.
allowed-tools:
  - Glob
  - Read
  - Edit
  - Write
  - Bash
---

# Documentation Updater

Keep project documentation in sync with the code. Invoked at the end of an implementation workflow. The primary goal is to prevent documentation drift: new behavior left undocumented, removed behavior still documented, or prose that contradicts the current code.

## Input

A **base ref** (commit SHA or branch ref) supplied by the caller. The skill diffs the working tree against it.

**Version bumps are out of scope for this skill.** Use `planning:versioning` separately when a version bump is needed.

## Process

### 1. Establish what changed

Run `git diff <base>` and `git diff --stat <base>` to see every change on the branch — committed and uncommitted — relative to the base ref.

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

### 3. Discover documentation targets

In priority order:

1. **Well-known root files**: `README.md`, `CLAUDE.md`, `AGENTS.md`.
2. **Project-declared docs home**: read the files above for pointers like "docs live in `docs/`" or "see `website/content/`".
3. **Common docs directories** if not pointed to by a file above: `docs/`, `documentation/`, `website/`, `wiki/` at the repo root.

Treat `CLAUDE.md` and `AGENTS.md` as peers — updates to one usually need mirroring in the other. If only one exists, do not create the other; respect the project's choice.

`CHANGELOG.md` is out of scope for this skill. Leave release-note generation to a dedicated tool.

### 4. Make the updates

For each file that needs changes:

- Read the file first to match its tone, voice, structure, heading depth, and code-block conventions.
- Make targeted edits — touch only what the change affects.
- When editing `CLAUDE.md` or `AGENTS.md`, consult `reference/agent-instructions-guide.md` for authoring conventions.
- Do not add placeholders, TODOs, or "this section may need expansion" notes.
- Do not create new documentation files unless an existing file cannot reasonably host the content and the project has a pattern for adding one (e.g., a `docs/` directory with ADRs).

### 5. Report

After edits, produce a summary in this format:

```
## Documentation Updates

### Files Updated
- `path/to/file.md`: <one-line description of what changed and why>

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
- **Don't bloat agent-instruction files**: `CLAUDE.md` and `AGENTS.md` should stay actionable. Link to deeper docs instead of inlining.
- **One change at a time**: if the diff contains multiple unrelated changes, handle each in order and report them as distinct entries.
