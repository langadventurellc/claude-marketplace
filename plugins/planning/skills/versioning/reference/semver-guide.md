# Semver Bump Decision Guide

This guide is consulted by the `planning:versioning` skill when mode = `infer`. The caller has already decided a bump is happening; the guide's job is to pick the level.

## Baseline Decision Rules

| Change type | Bump level |
|---|---|
| Breaking change — removes or incompatibly changes existing behavior or a public API | `major` |
| Additive, backward-compatible change — new feature, flag, endpoint, or skill that doesn't break existing callers | `minor` |
| Bug fix, internal refactor, dependency update with no behavior change | `patch` |
| Doc-only change (in a conventional code repo only — see "Project-type-aware classification" below) | `patch` or no bump (but the skill's mandatory-bump invariant forces at least `patch` when invoked) |

## Pre-1.0 Caveats

For `0.x.y` versions, semver allows using `minor` instead of `major` for breaking changes (the version is still unstable). When in doubt for a pre-1.0 package, prefer `minor` for breaking changes unless the project's policy says otherwise.

## Project-Type-Aware Classification

**The meaning of "documentation" depends on the project type.**

### Conventional code repos (Node, Python, Rust, .NET, Go, etc.)

`.md` files are prose: README, guides, CHANGELOG, ADRs. Changes to them rarely affect the shipped artifact, so `patch` (or no bump when the skill is not invoked) is appropriate. Apply the baseline table as-is.

### Claude Code plugin repos

**Markdown IS the code.** Files under `agents/`, `skills/`, `commands/`, `hooks/`, and `.claude-plugin/` are runtime configuration. Claude Code reads them on every invocation; changes to these files change how the plugin behaves. They are never "doc-only" for versioning purposes.

Use this table for changes inside a Claude Code plugin:

| Change type | Bump level |
|---|---|
| Edit to SKILL.md body that changes documented behavior, default arguments, model selection, tool lists, or argument handling | `minor` |
| Edit to agent frontmatter (`model`, `tools`, `allowed-tools`, `description`) that changes defaults or capabilities | `minor` |
| Edit to SKILL.md or agent prose that clarifies without changing behavior (typo fix, rewording, tightened wording) | `patch` |
| Add a new skill, agent, command, or hook | `minor` |
| Remove or rename a skill, agent, command, or argument | `major` (or `minor` if pre-1.0) |
| Change a user-facing flag or argument shape in a backward-incompatible way | `major` (or `minor` if pre-1.0) |
| Edit to a file under a skill's `reference/` subdirectory | `patch` by default; `minor` if the reference encodes load-bearing rules that change caller behavior |
| Edit to `.claude-plugin/marketplace.json` metadata (source, entries, versions) | Depends on the nature of the change — apply the baseline rules. Removing a plugin entry is `major`; adding one is `minor`. |
| Edit to the plugin's own README.md | `patch` (plugin READMEs are user-facing docs, not runtime config). |

### Mixed repos

A repo can be both a plugin host and contain conventional code (e.g., a plugin's scripts/ directory with Python). Classify each changed file independently using the rules above and pick the highest bump level across all files.

## Monorepo Independence Rule

In a monorepo, each plugin or package is versioned independently. Bump only the version file(s) for the package(s) whose diff scope actually changed. Do NOT cascade a bump to unrelated packages.

## Project-Specific Policy Takes Precedence

Before applying any rule in this guide, check for a `VERSIONING.md`, a versioning section in `CONTRIBUTING.md`, or explicit versioning guidance in `CLAUDE.md` / `AGENTS.md`. If found, follow it instead. This guide is a fallback, not an override.

## Mandatory-Bump Invariant

When this guide is consulted by the `planning:versioning` skill, the caller has already committed to bumping. "No bump" is not a valid outcome of applying these rules. If a change is genuinely trivial (whitespace-only, comment-only, test-only in a conventional repo), the level is `patch`. The caller owns the upstream decision of whether to invoke the skill in the first place.
