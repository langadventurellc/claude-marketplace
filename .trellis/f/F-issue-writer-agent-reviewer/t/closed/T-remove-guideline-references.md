---
id: T-remove-guideline-references
title: Remove guideline references from skills and delete guideline files
status: done
priority: medium
parent: F-issue-writer-agent-reviewer
prerequisites:
  - T-create-trellis-default-issue
  - T-update-trellis-default
affectedFiles:
  plugins/task-trellis/skills/issue-creation/task.md: Removed
    testing-guidelines.md link from line 166 (kept surrounding text), removed
    entire Testing section (lines 195-197) that solely referenced the guideline
    file
  plugins/task-trellis/skills/issue-creation/feature.md: Removed testing-guidelines.md link from line 94 (kept surrounding text)
  plugins/task-trellis/skills/issue-implementation-review/SKILL.md:
    Removed testing-guidelines.md link from line 107 and
    code-documentation-guidelines.md link from line 125 (kept surrounding text
    for both)
  plugins/task-trellis/skills/issue-creation/testing-guidelines.md: Deleted - guidelines now embedded in trellis-default-issue-writer agent
  plugins/task-trellis/skills/issue-implementation-review/testing-guidelines.md: Deleted - guidelines now embedded in trellis-default-reviewer agent
  plugins/task-trellis/skills/issue-implementation-review/code-documentation-guidelines.md: Deleted - guidelines now embedded in trellis-default-reviewer agent
log:
  - "Removed all guideline file references from skills and deleted the
    now-redundant guideline files. Specifically: (1) removed two references to
    testing-guidelines.md from task.md (line 166 link text and entire Testing
    section at line 195-197), (2) removed one reference to testing-guidelines.md
    from feature.md (line 94 link text), (3) removed references to
    testing-guidelines.md and code-documentation-guidelines.md from
    issue-implementation-review/SKILL.md (lines 107 and 125), and (4) deleted
    all three guideline files. No allowed-tools frontmatter was changed in any
    skill."
schema: v1.0
childrenIds: []
created: 2026-02-07T21:29:03.222Z
updated: 2026-02-07T21:29:03.222Z
---

## Overview

Remove guideline file references from skills (since the guidelines are now embedded in agents) and delete the now-redundant guideline files. This cleanup task should only be done after the agents have been updated to contain the guidelines.

## Files to Modify

### 1. `plugins/task-trellis/skills/issue-creation/task.md`

Remove these two references to `testing-guidelines.md`:

**Line 166** — Remove the sentence referencing testing guidelines:
```
Note: Tests are included within tasks only where meaningful complexity exists, per the [Testing Guidelines](testing-guidelines.md). Separate integration test tasks are created only when critical cross-component interactions need verification.
```
Change to:
```
Note: Tests are included within tasks only where meaningful complexity exists. Separate integration test tasks are created only when critical cross-component interactions need verification.
```

**Line 197** — Remove the entire line:
```
Before creating any testing-related tasks, read the [Testing Guidelines](testing-guidelines.md).
```
Remove this line entirely (the testing guidelines are now in the `trellis-default-issue-writer` agent).

### 2. `plugins/task-trellis/skills/issue-creation/feature.md`

**Line 94** — Remove the testing guidelines reference:
```
  - **Testing Requirements** - What meaningful tests are needed (see [Testing Guidelines](testing-guidelines.md))
```
Change to:
```
  - **Testing Requirements** - What meaningful tests are needed
```

### 3. `plugins/task-trellis/skills/issue-implementation-review/SKILL.md`

**Line 107** — Remove the testing guidelines reference:
```
- **Test coverage**: Tests exist for the new functionality (see [Testing Guidelines](testing-guidelines.md))
```
Change to:
```
- **Test coverage**: Tests exist for the new functionality
```

**Line 125** — Remove the code documentation guidelines reference:
```
Evaluate code documentation against the [Code Documentation Guidelines](code-documentation-guidelines.md):
```
Change to:
```
Evaluate code documentation:
```

## Files to Delete

After removing the references, delete these three files:

1. `plugins/task-trellis/skills/issue-creation/testing-guidelines.md`
2. `plugins/task-trellis/skills/issue-implementation-review/testing-guidelines.md`
3. `plugins/task-trellis/skills/issue-implementation-review/code-documentation-guidelines.md`

## Important Constraints

- Do NOT change any `allowed-tools` in any skill's frontmatter
- Do NOT change any skill logic or workflow — only remove the markdown link references
- Keep the surrounding text intact — only strip the `(see [Testing Guidelines](testing-guidelines.md))` and similar link markup
- For `task.md` line 197, remove the entire line since it's solely about reading the guidelines file

## Acceptance Criteria

1. `issue-creation/task.md` has no references to `testing-guidelines.md`
2. `issue-creation/feature.md` has no references to `testing-guidelines.md`
3. `issue-implementation-review/SKILL.md` has no references to `testing-guidelines.md`
4. `issue-implementation-review/SKILL.md` has no references to `code-documentation-guidelines.md`
5. `issue-creation/testing-guidelines.md` is deleted
6. `issue-implementation-review/testing-guidelines.md` is deleted
7. `issue-implementation-review/code-documentation-guidelines.md` is deleted
8. No `allowed-tools` changed in any skill frontmatter
9. Surrounding text in modified lines reads naturally without the removed links

## Out of Scope

- Creating or modifying any agent files (handled by separate tasks)
- Updating orchestration skills' agent type references (handled by a separate task)