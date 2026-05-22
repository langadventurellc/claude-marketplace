---
name: issue-verification
description: QA-validates a completed Trellis issue by exercising the changed code the way it runs in production — drafts a test plan, gets user approval, then executes it and reports pass/fail/blocked. Use when asked to "QA", "verify", "validate the behavior of", "exercise", or "smoke-test" a completed Trellis task, feature, epic, or project by ID. This is verification via execution, not re-running the automated test suite.
disable-model-invocation: true
allowed-tools:
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__list_issues
  - AskUserQuestion
  - Read
  - Bash
---

# Issue Verification

QA-validate a completed Trellis issue by *running* the changed code in conditions as close to production as the environment allows, then reporting what passed, failed, or could not be verified.

QA here means **verification through execution**. It is distinct from the automated test suite (the developer and reviewer already ran that) and from code review (the reviewer already read the diff). Your job is to exercise the change end-to-end and observe whether the intended behavior actually landed.

## Input

`$ARGUMENTS` — a single Trellis issue ID: a task (`T-`), feature (`F-`), epic (`E-`), or project (`P-`). The common case is a feature.

If no ID is given or it is ambiguous, ask the user before proceeding.

## What this skill does NOT do

- **Does not re-run the test suite.** `npm test` / `pytest` / `go test` ran during review. Re-running them verifies nothing new.
- **Does not QA read-catchable changes.** If a reviewer could confirm correctness by reading it — docs, comments, renames, type-only edits, config wording — it is out of scope. QA is for behavior that only running the code reveals.
- **Does not modify the code under test.** You exercise it; you do not fix it. Report findings instead.

## Process

### 1. Resolve scope

Call `get_issue` on the ID and branch on its `type`:

- **Feature** (optimize for this case): the issue body holds the acceptance criteria — the behavior to verify. Call `list_issues` for its child tasks; for each `done` child, read its `modifiedFiles` and implementation log. QA the **integrated** behavior the tasks produce together, framed against the feature's acceptance criteria, not each task in isolation.
- **Task**: scope to that one task's `modifiedFiles`. Verify the single behavior the task describes.
- **Epic / Project**: one level up. Enumerate `done` child features via `list_issues`, then apply the feature flow to the highest-risk one or two (the most-changed, most-integrated, most user-facing) rather than every feature. State which you chose and why in the plan.

### 2. Triage the diff to execution-worthy changes

Union the `modifiedFiles` across the in-scope `done` issues. Run `git diff <base> -- <files>` (base is typically `main`; resolve via `git symbolic-ref refs/remotes/origin/HEAD`) and `Read` the files for context.

Split the changes into two piles and **discard the first**:

- **Read-catchable** — docs, comments, naming, formatting, type-only changes, static config text. The reviewer owns these. Do not build test cases for them.
- **Execution-required** — anything where running reveals something reading cannot: actual outputs, side effects, state changes, integration across module/process/network boundaries, runtime errors, control flow under real inputs. These are your candidate test cases.

If *every* change is read-catchable (e.g. a docs-only or pure-rename issue), there is nothing to QA — say so and stop. Do not invent execution to look thorough.

### 3. Detect environment, then choose a strategy

Probe before deciding — do not assume a strategy. Check for: language runtimes (`node`/`python3`/`elixir`/`go --version`), `docker` and `docker compose`, project entry points (`package.json` scripts, `Makefile`, `mix.exs`, compose files), and any recorded launch recipe under `.claude/skills/run-*/`. The bundled `/run` and `/verify` skills can launch the app when a manual launch is awkward; lean on them rather than reinventing launch inference.

Pick the **most isolated strategy the environment supports**, in this order:

1. Disposable container / `docker compose` stack — best for integration-style verification against real dependencies.
2. Ephemeral local server or process on a non-default port — for HTTP/CLI surfaces; drive it with `curl` or the real client.
3. In-process script against the changed modules — e.g. an Elixir script calling the changed functions directly, a one-off node/python invocation.

Never run against shared or production data. Use synthetic, disposable inputs. If a change is itself a Claude Code skill or agent, verify it headless — see [headless-skill-qa.md](headless-skill-qa.md).

### 4. Draft the test plan

One plan item per behavior. Each item states, in this order:

- **Objective** — the single behavior being verified.
- **Preconditions & setup** — state, fixtures, and what gets started or built.
- **Steps** — the concrete commands/actions you will run.
- **Expected result** — defined *now, before execution*. Deciding what "correct" looks like only after seeing output is how an agent rationalizes whatever it got; commit to the expectation up front.
- **Teardown** — how the environment returns to its starting state (stop containers, kill processes, free ports, delete temp files).

Order items by risk: exercise the highest-value integrated path first, not broad shallow coverage. Include at least one negative / error-condition case for any high-risk behavior — the happy path alone is not verification.

### 5. Get approval

Present the full plan, then call `AskUserQuestion` with these options:

- **Run it** — execute the plan as drafted.
- **Modify** — revise per the user's direction, then re-present.
- **Reject** — discard the plan; ask what to do instead.
- **Don't test** — stop without executing.

Do not start executing before the user picks "Run it".

### 6. Execute

For each approved item:

- Run the steps and **capture the evidence verbatim** — command output, exit codes, logs, HTTP response bodies.
- Make **one explicit assertion** comparing actual against the expected result you committed to in step 4. A clean exit code or absence of a crash is not a pass — assert the *behavior*.
- Mark the item **Pass**, **Fail**, or **Blocked**. An item you could not actually run (missing dependency, environment wouldn't come up, no viable strategy) is **Blocked**, never Pass. A pass with no captured evidence is **Blocked**.
- Run the teardown, every time, even on failure.

### 7. Report

```
## Verification Report — <issue-id>

### Summary
<N passed, N failed, N blocked> against <feature/issue acceptance criteria>

### Results
- [Pass]    <objective> — <assertion that held, with evidence ref>
- [Fail]    <objective> — expected <X>, observed <Y> | <evidence>
- [Blocked] <objective> — <why it could not be verified>

### Findings
- <behavioral defects found, with the evidence that demonstrates them>
```

Omit the Findings section if nothing failed. Report Blocked honestly — "could not verify, here's why" is a real outcome, and a silent pass on unverified behavior is the failure this skill exists to prevent.
