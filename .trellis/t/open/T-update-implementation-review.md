---
id: T-update-implementation-review
title: Update implementation-review output to actionable-only format
status: open
priority: medium
parent: none
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T00:59:51.279Z
updated: 2026-01-30T00:59:51.279Z
---

# Update Implementation-Review Output Format

Change the `issue-implementation-review` skill output to be actionable-only, since AI agents consume this output and don't need verbose "everything looks good" sections.

## Reference

Full requirements: `docs/orchestration-enhancements-requirements.md` (Change 4)

## File to Modify

`plugins/task-trellis/skills/issue-implementation-review/SKILL.md`

## Current Behavior

The skill returns a full report with sections for:
- Context Summary
- Correctness Assessment (with Status)
- Completeness Assessment (with Status)
- Simplicity Assessment (with Status)
- Code Quality
- Recommendations
- Verdict (APPROVED / NEEDS REVISION / REJECTED)

## New Behavior

Return only items that require action. Skip positive assessments and status indicators for things that passed.

### New Output Format

Replace the "Review Report Template" section with:

```
## Review Findings

### Critical (must fix)
- [Issue with file:line reference and specific problem]

### Recommendations
- [Suggested improvement with rationale]

### Gaps
- [Missing requirement or functionality]

### Questions
- [Item needing user clarification]
```

**Important rules:**
- If a section has no items, omit the section entirely
- If there are no findings at all, return: `No issues found.`
- No verdict section—empty output implicitly means approved
- Remove all "Status: Correct/Complete/Appropriate" lines
- Remove "Context Summary" section
- Remove "Code Quality" checklist unless there are issues to report

### What to Remove

- Verdict section entirely
- Status indicators (Correct, Complete, Appropriate, etc.)
- Positive observations that don't require action
- "Everything looks good" type content
- Context Summary section (the caller already knows the context)
- Requirements Coverage checklist with checkmarks (only list gaps)

### What to Keep

- Critical issues that must be fixed
- Recommendations for improvements
- Gaps in functionality or requirements
- Questions needing user clarification
- Specific code references (file:line) for all findings
- The "When to Return Early" section for clarification needed

## Acceptance Criteria

- [ ] Output format updated to actionable-only structure
- [ ] Removes verdict section
- [ ] Removes positive/passing assessments
- [ ] Removes Context Summary section
- [ ] Removes status indicators
- [ ] Empty findings returns "No issues found."
- [ ] Retains: critical issues, recommendations, gaps, questions
- [ ] Keeps specific file:line references for findings
- [ ] Keeps the "When You Need Clarification" early return pattern

## Technical Notes

- This is primarily a documentation change to the output template
- The review process sections (1-5) remain the same—only the output format changes
- Keep the "Review Standards" section as guidance for the review agent