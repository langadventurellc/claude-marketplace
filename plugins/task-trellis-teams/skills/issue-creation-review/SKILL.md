---
name: issue-creation-review
description: Verifies Trellis issues against original requirements for completeness, correctness, and appropriate scope. Use when asked to "verify issue", "validate trellis issue", "check issue completeness", or "review created issue".
allowed-tools:
  - Glob
  - Grep
  - Read
  - WebFetch
  - WebSearch
  - mcp__plugin_task-trellis-teams_task-trellis__get_issue
  - mcp__plugin_task-trellis-teams_task-trellis__list_issues
---

# Issue Creation Review

Verify that a created Trellis issue accurately reflects original requirements without over-engineering or missing critical elements.

## Required Inputs

- **Original Requirements**: The initial request or specifications
- **Created Issue**: The issue ID or full issue details
- **Additional Context** (optional): Clarifications or decisions made during creation

## Handling Missing Information

**This skill runs as a sub-agent and cannot ask questions directly.** If required inputs are missing or unclear, you must return a structured response requesting clarification instead of proceeding with assumptions.

When information is missing or ambiguous, return the following structure:

```
## Clarification Needed

### Questions
1. [Specific question about missing/unclear information]
2. [Additional questions as needed]

### Context Collected So Far
- [Summary of what you've already determined]
- [Relevant codebase findings]
- [Partial analysis completed]

### Instructions for Caller
1. Gather answers to the questions above from the user
2. Re-invoke this skill with the original inputs plus the following additional context:
   - Answers to questions: [list the questions by number]
   - Previously collected context: [reference this section]
```

**Do not make assumptions** about requirements, scope decisions, or implementation details when critical information is missing.

## Verification Process

### 1. Research Codebase Context

Before evaluating, investigate the existing system:

- Search for similar implementations to verify consistency
- Check architectural patterns used in the codebase
- Identify existing utilities/libraries that should be leveraged
- Verify integration points mentioned are valid

### 2. Completeness Check

Verify all required elements are present.

**Common to all issue types:**

- All functional requirements from input are addressed
- Acceptance criteria are measurable and complete
- Dependencies/integration points are identified

**Type-specific additions:**

| Type    | Additional Requirements                              |
| ------- | ---------------------------------------------------- |
| Project | Technical architecture specified                     |
| Epic    | Clear scope boundaries, logical feature grouping     |
| Feature | Specific user-facing capability, feature integration |
| Task    | Implementable scope, clear technical specifications  |

### 3. Correctness Check

- **Technical Accuracy**: Proposed solutions align with codebase patterns
- **Requirement Alignment**: Interpretation matches user intent
- **Feasibility**: Approach is technically viable
- **Consistency**: Aligns with existing system architecture

### 4. Attachment Verification

Check that source materials were properly attached and referenced per the attachment custody rules.

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
- Includes a direct on-disk path using `${TRELLIS_DATA_DIR:-~/.trellis}` as the base — NOT a hardcoded `~/.trellis` path.

```markdown
## Attachments

See `<filename>` on `<holder-id>`. Direct path: `${TRELLIS_DATA_DIR:-~/.trellis}/projects/<projectKey>/.../<holder-type>/<holder-id>/attachments/<filename>`
```

To spot-check `<projectKey>` against the on-disk directory, see [`../issue-creation/attachment-paths.md`](../issue-creation/attachment-paths.md).

**Cross-reference blocking rule**

If source materials were available during the writing session — planning output was produced, the user supplied file paths, or files were referenced in the task description or parent issue body — and the writer did NOT attach them to the appropriate holder, **block the review**. This is not a minor finding.

Use these contextual signals to detect suspected omissions:
- Prior planning-skill output visible in the conversation (requirements-creation summary, discovery report).
- File paths mentioned in the task description or the requirements that the writer had access to.
- Attachment listings on the parent issue that imply related source materials should propagate to children.

### 5. Scope Assessment

Evaluate for over-engineering:

- Identify additions beyond the original request
- Flag unnecessary complexity or premature optimization
- Ensure abstractions are justified by actual requirements

**Exception**: Expanded scope is acceptable if explicitly requested (e.g., "comprehensive" or "future-proofed" solution).

## Cohesion Review (parent + children)

When your task is a cohesion review (not a single-issue review), the input is a parent issue ID plus a list of child issue IDs. Apply this rubric instead of the standard single-issue verification process.

**Step 1 — Fetch the parent issue and all children.** Call `mcp__plugin_task-trellis-teams_task-trellis__get_issue` for the parent ID and for each child ID. Both are required inputs to the rubric, not just context.

**Step 2 — Alignment check.** Do the children, taken as a whole, deliver what the parent issue says it needs? Walk each parent acceptance criterion and scope clause and confirm at least one child addresses it. List any parent requirement not addressed by any child.

**Step 3 — Scope overlap scan.** For each pair of siblings, compare their descriptions and acceptance criteria. Flag overlap when two siblings describe responsibility for the same functional area, file, or subsystem. Cite the exact language from each sibling that creates the conflict. (No-op when only one child exists.)

**Step 4 — Coverage gap scan.** Map each requirement from the verbatim product requirements to at least one child. List any requirement with no owning child.

**Step 5 — Prerequisite coherence check.** For each child, read its `prerequisites` field. Identify: (a) logical dependencies implied by the child descriptions that are not expressed as prerequisites, and (b) listed prerequisites that do not correspond to logical dependencies. (No-op when only one child exists.)

**Step 6 — Attachment consistency check.** Verify that the child set as a whole respects the attachment custody rules: attachments reside on the shared parent (not duplicated across children), every child that depends on an attachment has a correctly formatted `## Attachments` section, and no child holds a redundant copy of a file already on the parent.

**Step 7 — Deliver findings.** Send a single `SendMessage` to the writer with grouped findings (alignment gaps, overlap, coverage gaps, prerequisite issues, attachment issues). If no issues, mark the cohesion review task done.

## Teammate Mode

When running as a teammate inside an agent team:

- **Fix cycles**: Send findings as a single `SendMessage` to the writer (writer name is in your task-list entry). Do NOT mark the review task done. Wait for the writer to notify you when fixes are ready, then re-review. Repeat until all critical findings are resolved.
- **Stall escalation**: If the same finding returns more than 3 times, or there is a genuine dispute, escalate via `SendMessage({ to: "team-lead", ... })`. Do NOT approve a review just to move on.

## Output

Provide a verification report covering:

1. **Issue Details**: Type, ID, title
2. **Completeness**: Complete/Partial/Incomplete with specific gaps
3. **Correctness**: Correct/Issues Found with specific findings and codebase alignment
4. **Attachments**: Verified/Findings — holder placement, duplication, section format, child references, and any suspected omissions
5. **Scope**: Appropriate/Over-engineered with analysis of what was requested vs. created
6. **Recommendations**: Critical issues and suggested improvements
7. **Verdict**: APPROVED / NEEDS REVISION / REJECTED with summary

Use codebase evidence to support findings. Flag over-engineering only when it adds complexity without benefit.
