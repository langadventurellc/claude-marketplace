---
name: issue-creation-review
description: Verifies Trellis issues against original requirements for completeness, correctness, and appropriate scope. Use when asked to "verify issue", "validate trellis issue", "check issue completeness", or "review created issue".
allowed-tools:
  - AskUserQuestion
  - Glob
  - Grep
  - Read
  - SendMessage
  - TaskUpdate
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
---

# Issue Creation Review

Verify that a created Trellis issue accurately reflects original requirements without over-engineering or missing critical elements.

## Required Inputs

- **Original Requirements**: The initial request or specifications
- **Created Issue**: The issue ID or full issue details
- **Additional Context** (optional): Clarifications or decisions made during creation

If any required input is missing or unclear, ask the user before proceeding. Do not make assumptions about requirements, scope decisions, or implementation details.

## Verification Process

### 1. Research Codebase Context

Before evaluating, investigate the existing system so findings are grounded, not speculative:

- Search for similar existing implementations (`Grep`, `Glob`, `Read`) to verify the issue's proposed approach matches the codebase's patterns.
- Check architectural conventions the issue should be consistent with.
- Identify existing utilities or libraries the issue should reuse instead of reinventing.
- Verify every file, path, or symbol the issue references actually exists. **The codebase is the source of truth, not the issue body.** If the issue cites something that no longer exists (or never did), that is a finding — even if the parent issue makes the same reference.

### 2. Completeness Check

Verify against the **original user requirements verbatim** in your inputs, not a paraphrase of them.

**Common to all issue types:**

- All functional requirements from the verbatim requirements are addressed.
- Acceptance criteria are measurable and complete — specific, testable conditions, not vague language like "should work correctly."
- Dependencies/integration points are identified.

**Type-specific additions:**

| Type    | Additional Requirements                             |
| ------- | --------------------------------------------------- |
| Project | Technical architecture specified                    |
| Epic    | Clear scope boundaries, logical feature grouping    |
| Feature | Specific user-facing capability, integration points |
| Task    | Implementable scope, clear technical specifications |

### 3. Correctness Check

- **Technical accuracy**: Proposed solutions align with actual codebase patterns, back-verified via step 1 research.
- **Requirement alignment**: The issue's interpretation matches the verbatim requirements — not a paraphrase that drifts from intent.
- **Feasibility**: The approach is technically viable in this codebase with the libraries and patterns already in use.
- **Consistency**: Aligns with existing system architecture and neighbor issues under the same parent.

### 4. Attachment Verification

Check that source materials were properly attached and referenced per the attachment custody rules.

The authoritative list of attachments on any issue is the `attachments` array returned at the top level of `get_issue` — independent of whatever the body's `## Attachments` section claims. A child that references a parent holder will have its own `attachments` array empty; fetch the holder via `get_issue` to inspect its `attachments`.

**Check 1 — Correct holder placement**

Attachments must follow the single-source-of-truth hierarchy:

- When a parent exists (tasks under a feature, features under an epic, etc.): source materials belong on the **parent** issue only. Children must reference the parent's attachments — not hold their own copy.
- When creating a project (top-level, no parent): attachments belong on the project.
- When creating a flat list with no common ancestor: duplicate-attaching the same file to each issue is acceptable.

**Check 2 — No redundant duplication**

When a shared parent exists, the same source file MUST NOT appear as an attachment on multiple sibling children. Confirm the flat-list exception applies (no common ancestor) before allowing duplicate attachments across siblings.

**Check 3 — `## Attachments` section in holder issues**

Every holder issue that has attachments must include an `## Attachments` section listing each filename with a one-line description of what it is and why it matters:

```markdown
## Attachments

- `<filename>` — <one-line description>
```

**Check 4 — `## Attachments` section in child issues**

Every child issue that depends on an attached source material must include an `## Attachments` section that:

- Names the holder issue ID and the specific filename (e.g., `See <filename> on <holder-id>`).
- Includes a literal absolute on-disk path (e.g. `/Users/<you>/.trellis/projects/<projectKey>/.../attachments/<filename>`). Reject shell-style templates like `~/.trellis/...` or `${TRELLIS_DATA_DIR:-~/.trellis}/...` — `Read` does not expand them, so either form is unusable.

```markdown
## Attachments

See `<filename>` on `<holder-id>`. Direct path: `/Users/<you>/.trellis/projects/<projectKey>/<holder-segments>/<holder-id>/attachments/<filename>`
```

Confirm the cited path actually opens via `Read` before approving. See [`../issue-creation/attachment-paths.md`](../issue-creation/attachment-paths.md).

**Cross-reference blocking rule**

If source materials were available during the writing session — planning output was produced, the user supplied file paths, or files were referenced in the task description or parent issue body — and the writer did NOT attach them to the appropriate holder, **block the review**. This is not a minor finding.

Use these contextual signals to detect suspected omissions:

- Prior planning-skill output visible in the conversation (requirements-creation summary, discovery report).
- File paths mentioned in the task description or the requirements that the writer had access to.
- Attachment listings on the parent issue that imply related source materials should propagate to children.

### 5. Scope Assessment

Evaluate for over-engineering:

- Flag additions beyond what the verbatim requirements asked for.
- Flag unnecessary abstractions or premature optimization.
- Flag speculative content ("we might also want to...") that isn't anchored in the requirements.
- Flag any issue whose primary deliverable is a version bump (e.g., bumping `plugin.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`). Version bumps are handled by `planning:versioning` at the end of implementation, not as Trellis work. This is a REJECT-grade finding even if the original requirements explicitly asked for it — the writer should have dropped it from scope. This rule targets bumping a version _number_ in metadata files; legitimately version-adjacent work (e.g., "add version detection to the runtime") is not in scope of this rule.

**Exception**: Expanded scope is acceptable if the requirements explicitly asked for it (e.g., the words "comprehensive" or "future-proofed" appear verbatim). This exception does **not** apply to version bumps.

## Cohesion Review (parent + children)

When your task is a cohesion review (not a single-issue review), the input is a parent issue ID plus a list of child issue IDs. Apply this rubric instead of the standard single-issue verification process.

**Step 1 — Fetch the parent issue and all children.** Call `mcp__plugin_task-trellis-teams_task-trellis__get_issue` for the parent ID and for each child ID. Both are required inputs to the rubric, not just context.

**Step 2 — Alignment check.** Do the children, taken as a whole, deliver what the parent issue says it needs? Walk each parent acceptance criterion and scope clause and confirm at least one child addresses it. List any parent requirement not addressed by any child.

**Step 3 — Scope overlap scan.** For each pair of siblings, compare their descriptions and acceptance criteria. Flag overlap when two siblings describe responsibility for the same functional area, file, or subsystem. Cite the exact language from each sibling that creates the conflict. (No-op when only one child exists.)

**Step 4 — Coverage gap scan.** Map each requirement from the verbatim product requirements to at least one child. List any requirement with no owning child.

**Step 5 — Prerequisite coherence check.** For each child, read its `prerequisites` field. Identify: (a) logical dependencies implied by the child descriptions that are not expressed as prerequisites, and (b) listed prerequisites that do not correspond to logical dependencies. (No-op when only one child exists.)

**Step 6 — Attachment consistency check.** Verify that the child set as a whole respects the attachment custody rules: attachments reside on the shared parent (not duplicated across children), every child that depends on an attachment has a correctly formatted `## Attachments` section, and no child holds a redundant copy of a file already on the parent.

**Step 7 — Deliver findings.** Send a single `SendMessage` to the writer with grouped findings (alignment gaps, overlap, coverage gaps, prerequisite issues, attachment issues). If no issues, mark the cohesion review task done via `TaskUpdate` AND send a one-line DM to the lead: `SendMessage({ to: "team-lead", summary: "approved <parent-id>", message: "approved <parent-id>" })`. The one-line DM is required — the lead waits on it to advance. Do NOT send "looks good" or any other commentary.

## Teammate Mode

When running as a teammate inside an agent team:

- **Fix cycles**: Send findings as a single `SendMessage` to the writer (writer name is in your task-list entry). Do NOT mark the review task done. Wait for the writer to notify you when fixes are ready, then re-review. Repeat until all critical findings are resolved.
- **Stall escalation**: If the same finding returns more than 3 times, or there is a genuine dispute, escalate via `SendMessage({ to: "team-lead", ... })`. Do NOT approve a review just to move on.

## Output

Output format depends on invocation context:

- **Teammate mode** (running inside an agent team): see `Teammate Mode` above. Approval is `TaskUpdate({ status: "done" })` plus a single one-line DM to the lead (`SendMessage({ to: "team-lead", summary: "approved <issue-id>", message: "approved <issue-id>" })`, ≤80 chars). The one-line DM is required — it is the lead's only signal that the review closed cleanly, and skipping it stalls the team. Do NOT send "looks good" or any other commentary; the one-liner is the only allowed approval signal. Revisions go to the writer via `SendMessage` using the findings format defined by your host agent. Cohesion review uses the grouped-findings format from step 7.
- **Direct invocation** (e.g., user-invoked via `/issue-creation-review`): produce a verification report with these sections:
  1. **Issue Details**: Type, ID, title
  2. **Completeness**: Complete/Partial/Incomplete with specific gaps
  3. **Correctness**: Correct/Issues Found, with codebase evidence
  4. **Attachments**: Verified/Findings — holder placement, duplication, section format, child references, suspected omissions
  5. **Scope**: Appropriate/Over-engineered, with what was requested vs. created
  6. **Recommendations**: Critical issues and suggested improvements
  7. **Verdict**: APPROVED / NEEDS REVISION / REJECTED

Use codebase evidence to support findings. Flag over-engineering only when it adds complexity without benefit.
