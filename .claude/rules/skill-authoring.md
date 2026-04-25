---
paths:
  - "**/SKILL.md"
  - "plugins/*/skills/**/*.md"
---

# Skill authoring rules

These rules apply when writing or reviewing any skill in this repo. The goal: skills that drive their own job forward and nothing else.

## 1. Every section must push the skill forward

For each line you add, ask: **"Is this part of doing the thing this skill does?"** If not, cut it.

Skills are read by agents who already operate in a constrained context. Padding their instructions with environment caveats, tooling preconditions, or host-platform notes makes them follow the skill *less* well, not more carefully. Distractions degrade performance.

Cut on sight:
- Version requirements ("Requires Claude Code v2.1.x+")
- Host environment caveats (Bedrock / Vertex / Foundry / self-hosted notes)
- Environment-variable disclaimers (`DISABLE_TELEMETRY`, `CLAUDE_CODE_DISABLE_*`, etc.)
- Tool-availability preflight checks that aren't part of the skill's actual work
- "If feature X is disabled in your install..." conditionals
- Generic safety boilerplate (handled in CLAUDE.md, not per-skill)

**Concrete anti-example — do not write things like this:**

> **Requires Claude Code v2.1.98+.** If the Monitor tool is unavailable (Bedrock/Vertex/Foundry environment, or `DISABLE_TELEMETRY` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` env vars set), stop immediately with a clear error explaining the requirement.

None of that helps the skill accomplish its job. It tells the agent about hosting, versions, telemetry flags, and an error-handling policy — none of which is *the work*. If a tool the skill depends on is missing, the tool call will fail and surface the failure on its own. Don't pre-document failure modes the runtime already reports.

## 2. This repo has one user. Don't engineer for robustness.

This marketplace is built for and used by exactly one person. "Works on my machine" is the entire production target. Skills do not need:

- Portability across environments
- Defensive checks for misconfigured installs
- Compatibility shims for older tool versions
- Graceful degradation when optional components are missing
- Polished error messages aimed at unfamiliar users

Write the skill for the actual environment it runs in. If something breaks, the user will fix the environment — that's faster than the skill carrying carrying a bunch of conditional logic forever.

## 3. No fallbacks. No alternate paths. No migrations.

Give the right way to do the thing. Stop there.

Do **not** add:
- "If approach A fails, try approach B" branches
- Workarounds for legacy state that may or may not exist
- Migration steps from a prior version of the workflow
- "Some users may have..." conditional handling
- Backwards-compatibility instructions for renamed tools, flags, or files

If the user wants a fallback, they will ask for it explicitly. Until then, the skill should describe one clear path: the one that should work.

## 4. When in doubt, cut

A shorter skill that does its job is strictly better than a longer skill that does its job *and* explains five edge cases the agent didn't need to know about. If a sentence isn't earning its place, delete it.
