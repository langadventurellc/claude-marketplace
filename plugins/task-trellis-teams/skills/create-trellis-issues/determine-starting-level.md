# Determine Starting Issue Level

**When to use this doc.** The lead reads this file from `SKILL.md` step 3 _only_ when both of the following are true:

1. No parent issue ID was supplied.
2. The user's requirements do not already name the level or types to create (e.g., they didn't say "create tasks for X", "a feature with tasks", "an epic and its features", "break this into features", etc.).

If either condition is false, skip this doc — the level is already known. Do not use this doc to second-guess guidance the user already gave.

## Inputs

Before applying the heuristics below, you should have:

- The verbatim user requirements captured in step 2.
- Any relevant codebase or scope context already gathered, such as requirements documents or prior-conversation history.

## Trellis hierarchy at a glance

| Level   | Typical scope                                                                 | Duration shape             | Example one-liner                                                       |
| ------- | ----------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| Project | A full system or product initiative with multiple distinct workstreams        | Many weeks to months       | "Build an observability platform with ingest, storage, and dashboards." |
| Epic    | A major work area inside a larger system; often multiple user-facing features | Weeks                      | "Authentication and session management."                                |
| Feature | A single implementable capability with a coherent user or developer story     | Days to a week; 3–10 tasks | "Password reset via email link."                                        |
| Task    | An atomic unit of work; ~1–2 hours for a developer                            | Hours                      | "Add rate-limiting middleware to `/api/register`."                      |

The sibling `issue-creation` skill's `project.md`, `epic.md`, `feature.md`, and `task.md` files define these levels in more detail. Consult them when a decision is borderline.

## Decision procedure

Walk the signals top-to-bottom. Stop at the first level whose **strong signals** match the request; that is the **root level** for this run.

### 1. Project

Strong signals:

- Describes a **complete new system, product, or platform** rather than a discrete feature.
- Contains multiple distinct workstreams (e.g., data layer + API + UI + ops) that would each be a meaningful epic on their own.
- Words like "system", "platform", "product", "initiative", "overhaul", "from scratch".

Action if matched:

- The lead authors a root creation task + review task pair for a Project (no parent, type project; reference `issue-creation/project.md` as the authoring guide in the creation task body). Spawn the writer/reviewer pair for the root level; wait for root approval before authoring Epic-level task pairs. Default behavior recurses all the way to leaf tasks; pass `--no-recursive` only if the user explicitly wants to stop after epics.

### 2. Epic

Strong signals:

- Describes a **major work area** larger than a single feature but narrower than a whole product.
- Would naturally split into 2–5 user-facing features.
- Words like "epic", "subsystem", "module", or multiple feature-sized deliverables listed together.

Action if matched:

- The lead authors a root creation task + review task pair for an Epic (no parent, type epic; reference `issue-creation/epic.md` as the authoring guide). Spawn the writer/reviewer pair for the root level; wait for root approval before authoring Feature-level task pairs. Default behavior recurses to leaf tasks; pass `--no-recursive` only if the user explicitly wants to stop after features.

### 3. Feature

Strong signals:

- Describes **one coherent capability** with a clear user or developer story.
- Fits naturally into roughly 3–10 tasks.
- Phrasing like "feature", "capability", "add X to Y", "build a plugin/component/tool that does Z", or the user implies tasks will follow ("with tasks", "and its tasks", "break this into work items").

Action if matched:

- The lead authors a root creation task + review task pair for a Feature (no parent, type feature; reference `issue-creation/feature.md` as the authoring guide). Spawn the writer/reviewer pair for the root level; wait for root approval before authoring Task-level task pairs. `--no-recursive` is moot at this level — tasks are already the leaf level, so the run stops there either way.

### 4. Task(s) only

Strong signals:

- Describes **one or a few small, concrete pieces of work** that do not cohere into a larger feature.
- Each item is atomic (1–2 hours).
- Phrasing like "a quick task to…", "just add…", "a small change…".

Action if matched:

- Running the writer/reviewer team for a single task is not worth the orchestration overhead. Stop the team-based flow and hand the request off to the sibling `task-trellis-teams:issue-creation` skill, then report back to the user.
- If there are a few clearly independent tasks and the user wants team-reviewed authoring, only create a standalone Feature umbrella when it adds real organizational value; otherwise prefer the direct path above.

## Applying the result

Once the root level is determined (for Project / Epic / Feature cases):

1. Create the agent team (SKILL.md step 4) — `TeamCreate` produces the shared task list that subsequent `TaskCreate` calls require.
2. Author a root creation task + review task pair on the shared task list (step 5a/5b templates; omit `parent` from the creation task description).
3. Spawn the writer/reviewer pair for the root level (step 6). The root level is a sibling set of size 1 — spawn one pair the same way as any other sibling-set pair.
4. Send the 'begin assigned work' nudge and wait for root approval (all root tasks marked done).
5. Use the root issue ID from the creation task's metadata (`createdIssueId`) as the parent for child-level task pairs.
6. Continue with the rest of SKILL.md (spawn a fresh writer/reviewer pair for each next-level sibling set, author child creation/review task pairs, etc.).

## When to escalate to the user

Use `AskUserQuestion` only when the determination is **genuinely** hard. Typical triggers:

- The request's scope is ambiguous between two adjacent levels (e.g., plausibly an epic or a large feature) and the choice would meaningfully change the shape of the output.
- The user's requirements include multiple distinct initiatives and it is unclear whether they want them bundled under one project or kept separate.
- Codebase research reveals a major hidden dependency that changes the implied scope.

When you do ask, present a focused question with concrete options drawn from this guide — do not dump the full four-level choice on the user unless the request is truly level-agnostic.

## Sibling-set sizing interacts with the root choice

`SKILL.md` step 5.0 caps any parent at 5 direct children per run. When the root-level decision would obviously force a single root with >5 children (e.g. the user describes work that clearly decomposes into 8 features, or 13 tasks), prefer to:

- Pick a **higher root level** so the work naturally fans out across multiple parents (e.g. an Epic with 2 Features, each with ≤5 tasks, instead of one Feature with 9 tasks), OR
- Plan to author **multiple root-level siblings** at the chosen level (e.g. 2 Features instead of 1) and split the work along natural seams.

Do not pick a root that would require breaking the max-5 rule downstream.

## Do not use this doc for

- **How many** children to author at a given level — granularity is covered by the sibling `issue-creation` docs ("default to coarser") and the max-5 sibling-set rule in `SKILL.md` step 5.0.
- Whether to set `--no-recursive` — that depends on whether the user wants to stop at the immediate child level rather than continue down to leaves; it is independent of the root-level decision.
- Deciding the **child** level when a parent is known — use the parent-type table in `SKILL.md` step 3 instead.
