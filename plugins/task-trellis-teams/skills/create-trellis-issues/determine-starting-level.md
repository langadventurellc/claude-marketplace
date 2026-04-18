# Determine Starting Issue Level

**When to use this doc.** The lead reads this file from `SKILL.md` step 3 *only* when both of the following are true:

1. No parent issue ID was supplied.
2. The user's requirements do not already name the level or types to create (e.g., they didn't say "create tasks for X", "a feature with tasks", "an epic and its features", "break this into features", etc.).

If either condition is false, skip this doc — the level is already known. Do not use this doc to second-guess guidance the user already gave.

## Inputs

Before applying the heuristics below, you should have:

- The verbatim user requirements captured in step 2.
- Any relevant codebase or scope context already gathered, such as requirements documents or prior-conversation history.

## Trellis hierarchy at a glance

| Level | Typical scope | Duration shape | Example one-liner |
|-------|---------------|----------------|-------------------|
| Project | A full system or product initiative with multiple distinct workstreams | Many weeks to months | "Build an observability platform with ingest, storage, and dashboards." |
| Epic | A major work area inside a larger system; often multiple user-facing features | Weeks | "Authentication and session management." |
| Feature | A single implementable capability with a coherent user or developer story | Days to a week; 3–10 tasks | "Password reset via email link." |
| Task | An atomic unit of work; ~1–2 hours for a developer | Hours | "Add rate-limiting middleware to `/api/register`." |

The sibling `issue-creation` skill's `project.md`, `epic.md`, `feature.md`, and `task.md` files define these levels in more detail. Consult them when a decision is borderline.

## Decision procedure

Walk the signals top-to-bottom. Stop at the first level whose **strong signals** match the request; that is the **root level** for this run.

### 1. Project

Strong signals:

- Describes a **complete new system, product, or platform** rather than a discrete feature.
- Contains multiple distinct workstreams (e.g., data layer + API + UI + ops) that would each be a meaningful epic on their own.
- Words like "system", "platform", "product", "initiative", "overhaul", "from scratch".

Action if matched:

- Lead creates a new Project via `mcp__plugin_task-trellis-teams_task-trellis__create_issue` (type `"project"`), using `issue-creation/project.md` as the authoring guide.
- Team then creates Epics under that project.
- Strongly consider `--recursive` so the run continues down to features and tasks.

### 2. Epic

Strong signals:

- Describes a **major work area** larger than a single feature but narrower than a whole product.
- Would naturally split into 2–5 user-facing features.
- Words like "epic", "subsystem", "module", or multiple feature-sized deliverables listed together.

Action if matched:

- Lead creates a standalone Epic via `mcp__plugin_task-trellis-teams_task-trellis__create_issue` (type `"epic"`, no parent), using `issue-creation/epic.md` as the authoring guide.
- Team then creates Features under that epic.
- Consider `--recursive` if the user expects leaf-level work produced in one pass.

### 3. Feature

Strong signals:

- Describes **one coherent capability** with a clear user or developer story.
- Fits naturally into roughly 3–10 tasks.
- Phrasing like "feature", "capability", "add X to Y", "build a plugin/component/tool that does Z", or the user implies tasks will follow ("with tasks", "and its tasks", "break this into work items").

Action if matched:

- Lead creates a standalone Feature via `mcp__plugin_task-trellis-teams_task-trellis__create_issue` (type `"feature"`, no parent), using `issue-creation/feature.md` as the authoring guide.
- Team then creates Tasks under that feature.
- Do NOT set `--recursive` — tasks are already the leaf level.

### 4. Task(s) only

Strong signals:

- Describes **one or a few small, concrete pieces of work** that do not cohere into a larger feature.
- Each item is atomic (1–2 hours).
- Phrasing like "a quick task to…", "just add…", "a small change…".

Action if matched:

- Running the writer/reviewer team for a single task is not worth the orchestration overhead. Stop the team-based flow and hand the request off to the sibling `task-trellis-teams:issue-creation` skill (or create the task directly via `mcp__plugin_task-trellis-teams_task-trellis__create_issue`), then report back to the user.
- If there are a few clearly independent tasks and the user wants team-reviewed authoring, only create a standalone Feature umbrella when it adds real organizational value; otherwise prefer the direct path above.

## Applying the result

Once the root level is determined (for Project / Epic / Feature cases):

1. **Create the root issue yourself** with `mcp__plugin_task-trellis-teams_task-trellis__create_issue` before creating the team. Use the matching type-specific file in the sibling `issue-creation` skill as the authoring guide for the root.
2. **Use the just-created issue's ID as the parent** and return to `SKILL.md` step 3's parent-type table to determine the child type for the team run.
3. **Continue with the rest of `SKILL.md`** (team creation, spawning teammates, authoring child creation/review task pairs, etc.).

The determination adds at most one `create_issue` call to the lead's workload before the team flow begins.

## When to escalate to the user

Use `AskUserQuestion` only when the determination is **genuinely** hard. Typical triggers:

- The request's scope is ambiguous between two adjacent levels (e.g., plausibly an epic or a large feature) and the choice would meaningfully change the shape of the output.
- The user's requirements include multiple distinct initiatives and it is unclear whether they want them bundled under one project or kept separate.
- Codebase research reveals a major hidden dependency that changes the implied scope.

When you do ask, present a focused question with concrete options drawn from this guide — do not dump the full four-level choice on the user unless the request is truly level-agnostic.

## Do not use this doc for

- **How many** children to author at a given level — granularity is covered by the sibling `issue-creation` docs ("default to coarser").
- Whether to set `--recursive` — that depends on whether the user wants leaf-level issues produced in this run, not on the root level.
- Deciding the **child** level when a parent is known — use the parent-type table in `SKILL.md` step 3 instead.
