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

Write the skill for the actual environment it runs in. If something breaks, the user will fix the environment — that's faster than the skill carrying a bunch of conditional logic forever.

## 3. No fallbacks. No alternate paths. No migrations.

Give the right way to do the thing. Stop there.

Do **not** add:
- "If approach A fails, try approach B" branches
- Workarounds for legacy state that may or may not exist
- Migration steps from a prior version of the workflow
- "Some users may have..." conditional handling
- Backwards-compatibility instructions for renamed tools, flags, or files

If the user wants a fallback, they will ask for it explicitly. Until then, the skill should describe one clear path: the one that should work.

## 4. The description is the only part Claude sees until the skill is invoked.

The `description` field in YAML frontmatter is the entire decision point for whether the skill fires. The body never gets read if the description didn't earn the trigger. Treat it as the most important content in the file.

Rules:

- **Third person.** "I can help with..." or "You can use this to..." cause discovery problems — Anthropic's docs are explicit about this. Write `"Investigates Jira tickets..."`, not `"I investigate Jira tickets..."`.
- **What it does + when to use it.** Both. Name the action *and* list the verbs the user actually says: `"investigate"`, `"scope this work"`, `"break down"`, `"orchestrate"`. Vague descriptions like `"Helps with documents"` don't earn triggers.
- **Surface routing behavior for router skills.** If the skill's job is to fetch context and hand off to another skill, say so. Otherwise Claude sees the trigger and skips past this skill straight to the downstream one — and your routing logic never runs.
- **Front-load it.** The combined `description` + `when_to_use` text is truncated at 1,536 characters in the skill listing. Put the trigger language first; don't bury it under prose about how the skill works internally.

## 5. Imperative voice, with a one-clause "why" when it isn't obvious.

Direct directives outperform hedged suggestions. But rigid all-caps mandates without rationale also fall short — Claude can't generalize to nearby cases without knowing why the rule exists.

The pattern that works — concrete directive, one-clause rationale:

> **Always arm a `Monitor` on `s2cLogPath` BEFORE calling any launch tool.** The sub's first message (`hello`) is the only liveness signal — `tail -n 0` discards lines written before the tail is armed, so arming late silently misses the handshake, causing the conductor to hang.

Claude can now generalize: any time the skill adds a new IPC channel, the same ordering applies. That's load-bearing.

Don't:
- Hedge: "you might want to consider arming a Monitor..."
- Mandate without rationale: "ALWAYS ARM A MONITOR. THIS IS CRITICAL."
- Restate Claude's defaults: "write clean code", "handle errors appropriately", "follow Python best practices." Claude already does.

## 6. Frontmatter must match the body.

`allowed-tools` lists exactly the tools the body invokes — no aspirational extras, no leftovers from earlier drafts. If the skill never calls `Read`, `Glob`, `Grep`, or `Bash`, they don't belong in the frontmatter "just in case." If you decide they should be available, add a step that actually uses them.

Plugin-bundled MCP tools must use the fully-qualified form: `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`. The bare `mcp__<server-name>__<tool-name>` form does not resolve and silently fails to register.

## 7. References you name must exist.

If the skill says `Skill plugin:planning:discovery`, that skill must be in the marketplace. If it points to `${CLAUDE_SKILL_DIR}/scripts/foo.sh`, the script must be in the directory. If it instructs Claude to invoke a specific MCP tool or run `/some-command`, that tool or command must be registered.

Hallucinated references don't fail at authoring time — they fail mid-task at runtime when the call doesn't resolve, after the user is committed. Run `find` or `grep` before committing the skill and verify every named skill, file, command, and tool actually exists.

## 8. When in doubt, cut — but cuts have a counterweight.

A shorter skill that does its job is strictly better than a longer skill that does its job *and* explains five edge cases the agent didn't need to know about. If a sentence isn't earning its place, delete it.

**But cuts have a counterweight.** Do not cut content that *is* doing real work just because it looks like prose. Keep:

- **Negative directives that counter Claude's defaults.** "Do not write the document to a file" reads like a no-op until you watch Claude default to file-writing without it. Same for "Do not pre-confirm the fetch", "Do not ask which route to take." If the directive is preventing a known Claude tendency, it's load-bearing.
- **Domain knowledge Claude doesn't already have.** Link-relevance sniff tests, IPC handshake semantics, why one field maps to one variable, the ordering constraint between two MCP calls. This is exactly what the body of a skill is for.
- **Skill-specific drift reinforcements.** Pinning behaviors Claude is known to drift on within *this* skill's flow ("a long document is not a turn-end") earns its place. Generic safety boilerplate ("be careful", "handle errors gracefully") does not — that's CLAUDE.md territory.
- **Concrete examples.** They teach faster than abstract rules. The worked example at the bottom of `investigate-jira-issue` walks the routing decision through a realistic ticket; that's training, not decoration.

The goal isn't *short*. The goal is *load-bearing*. If a sentence is doing real work, it stays — even if it looks at first glance like the kind of thing rules 1–3 would tell you to cut.
