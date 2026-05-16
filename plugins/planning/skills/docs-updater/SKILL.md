---
name: docs-updater
description: Reviews completed work and updates or creates project documentation (README, CLAUDE.md, AGENTS.md, .claude/rules/, docs/) to prevent stale docs. Invoked at the end of an implementation workflow with a base ref; diffs the working tree against that base to capture every change on the branch — committed and uncommitted.
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

**Pattern-level only for agent-instruction files.** For `CLAUDE.md`, `AGENTS.md`, and `.claude/rules/*.md`, update only on *pattern-level* changes — a new framework, a new build step, a new mandatory check, a new cross-cutting convention. Do not edit them for each new endpoint, route, schema field, or CRUD entry. Per-instance facts belong in the code; instruction files exist to teach patterns the agent cannot infer from reading code.

### 3. Discover documentation targets

Work outward from the diff, not from a fixed file list.

**Agent-instruction files** (`CLAUDE.md`, `AGENTS.md`):

- Check the repo root for `./CLAUDE.md`, `./.claude/CLAUDE.md`, and `./AGENTS.md`.
- For each changed file, walk its directory chain up to the repo root and note every `CLAUDE.md` / `AGENTS.md` along the way. Subdirectory files exist precisely to scope guidance to one subtree.
- Check `.claude/rules/*.md` for files whose `paths:` glob (in YAML frontmatter) matches changed paths. These are Claude Code's path-scoped tier for guidance tied to file patterns rather than directories.

**Project-declared docs home**: read the root agent-instruction files and the README for explicit pointers (e.g., "docs live in `docs/`", "see `website/content/`").

**Existing docs directories**: `docs/`, `documentation/`, `website/`, `wiki/`. Use only if the repo already has one — see § 5 on matching repo patterns.

**Symlinks.** If `CLAUDE.md` is a symlink to `AGENTS.md` (or vice versa), edit the link target (the real file). Don't replace the symlink with a regular file.

`CHANGELOG.md` is out of scope. Leave release-note generation to a dedicated tool.

### 4. Choose where each update goes

Pick the *most-local* file that already documents the affected surface. Apply these tests in order:

1. **Scope** — whole repo or one subtree? Subtree → the nearest subdirectory `CLAUDE.md` / `AGENTS.md`. Whole repo → the root file.
2. **Path pattern** — does the rule apply to files matching a glob (e.g., `src/api/**/*.ts`) rather than everything under a directory? Use `.claude/rules/<name>.md` with `paths:` frontmatter, not a nested file.
3. **Frequency** — would most sessions hitting this area need this rule? If only a minority would, push it deeper or to a referenced doc.
4. **Deducibility** — can the agent infer the rule by reading code or config? If yes, don't write it at all.
5. **Length budget** — if the chosen file is already at its budget (see `reference/agent-instructions-guide.md`), push the new content to a more-local file, a path-scoped rule, or a referenced doc rather than appending.

**Loading semantics differ — don't assume nesting replaces root.** `AGENTS.md` follows "nearest file wins" (the closest file's rules take precedence in its subtree). Claude Code's `CLAUDE.md` is *concatenated* root-down — every file in the chain is included, with the nearest appearing last and winning effective attention. A subdirectory `CLAUDE.md` therefore *stacks on top of* the root, not replaces it. Do not move a still-globally-true rule from root to a subdirectory expecting the root to fall silent.

### 5. Make the updates

For each file that needs changes:

- Read the file first to match its tone, voice, structure, heading depth, and code-block conventions.
- Make targeted edits — touch only what the change affects.
- When editing or creating `CLAUDE.md` or `AGENTS.md`, consult `reference/agent-instructions-guide.md` for length budgets, voice, splitting heuristics, and the integration patterns when both files exist.
- Do not add placeholders, TODOs, or "this section may need expansion" notes.

**Creating new files is allowed and often correct.** Create when:

- A subtree has accumulated guidance that should live with it rather than bloating the root (new `frontend/AGENTS.md`, `services/api/CLAUDE.md`).
- A new policy applies to a file pattern and no path-scoped rule yet covers it (new `.claude/rules/<name>.md` with `paths:` frontmatter).
- A procedure is long enough that inlining it would blow the agent-instruction file's budget (new `docs/<topic>.md`, with a one-line pointer from the instruction file).

**Match the repo's existing patterns.** Do not invent a documentation home the repo has not chosen:

- No `docs/` directory in the repo? Don't create one. Put the content next to the closest existing doc, or in the instruction file if it fits the budget.
- Only one of `CLAUDE.md` / `AGENTS.md` exists at root? The project picked a side. Don't create the missing peer.
- The existing `CLAUDE.md` / `AGENTS.md` is flat with no nested files? A new nested file is fine when the new guidance is genuinely subtree-local, but don't refactor existing flat content into a hierarchy as part of this skill's work.
- ADRs in `docs/adr/`? New architectural decisions go there in the same format. No ADR tradition? Don't start one.
- Doc filenames in the repo follow a convention (`SCREAMING_SNAKE.md`, `kebab-case.md`, sentence-case)? Match it.

When creating a new agent-instruction file, keep it focused on its subtree only — do not duplicate root guidance.

### 6. Report

After edits, produce a summary in this format:

```
## Documentation Updates

### Files Updated
- `path/to/file.md`: <one-line description of what changed and why>

### Files Created
- `path/to/new-file.md`: <one-line description of why a new file was the right call>

### Summary
<2-3 sentences: what changed in the code, what doc surface it affected, what was updated or created>

### Notes
<Optional: anything the caller should double-check, or questions that couldn't be answered from the diff alone. Omit if none.>
```

Omit the `Files Created` block if no files were created.

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
- **Don't bloat agent-instruction files**: `CLAUDE.md` and `AGENTS.md` should stay actionable. Push depth to nested files, path-scoped rules, or referenced docs.
- **One change at a time**: if the diff contains multiple unrelated changes, handle each in order and report them as distinct entries.
