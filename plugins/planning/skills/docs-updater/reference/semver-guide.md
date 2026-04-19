# Semver Bump Decision Guide

## Decision Rules

| Change type | Bump level |
|---|---|
| Breaking change — removes or incompatibly changes existing behavior or a public API | `major` |
| Additive, backward-compatible change — new feature, flag, endpoint, or skill that doesn't break existing callers | `minor` |
| Bug fix, internal refactor, doc-only change, dependency update with no behavior change | `patch` |

## Pre-1.0 Caveats

For `0.x.y` versions, semver allows using `minor` instead of `major` for breaking changes (the version is still unstable). When in doubt for a pre-1.0 package, prefer `minor` for breaking changes unless the project's policy says otherwise.

## Plugin / Doc-Only Changes

- A change that only updates documentation (`.md` files, skill descriptions, frontmatter `description`) without changing behavior → typically `patch`, often no bump at all.
- A change that adds a new skill, flag, or tool → `minor`.
- A change that removes or renames a skill, flag, or tool in a way that breaks existing invocations → `major` (or `minor` if pre-1.0).

## Monorepo Independence Rule

In a monorepo, each plugin or package is versioned independently. Bump only the version file(s) for the package(s) whose diff scope actually changed. Do NOT cascade a bump to unrelated packages.

## Project-Specific Policy Takes Precedence

Before applying any rule in this guide, check for a `VERSIONING.md`, a versioning section in `CONTRIBUTING.md`, or explicit versioning guidance in `CLAUDE.md`/`AGENTS.md`. If found, follow it instead. This guide is a fallback, not an override.
