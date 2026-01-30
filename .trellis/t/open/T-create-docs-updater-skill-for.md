---
id: T-create-docs-updater-skill-for
title: Create docs-updater skill for automatic documentation maintenance
status: open
priority: high
parent: none
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T00:59:11.604Z
updated: 2026-01-30T00:59:11.604Z
---

# Create docs-updater Skill

Create a new skill that reviews completed feature work and updates documentation files as needed. This skill is invoked by the orchestration workflow after implementation is complete and before the feature is marked done.

## Reference

Full requirements: `docs/orchestration-enhancements-requirements.md` (Change 2)

## File to Create

`plugins/task-trellis/skills/docs-updater/SKILL.md`

## Skill Properties (Frontmatter)

```yaml
---
name: docs-updater
description: Reviews completed feature work and updates documentation files (CLAUDE.md, README.md, docs/) as needed. Invoked after implementation is complete.
context: fork
agent: general-purpose
allowed-tools:
  - Glob
  - Grep
  - Read
  - Edit
  - Write
  - Bash
  - mcp__task-trellis__get_issue
  - mcp__task-trellis__list_issues
---
```

## Skill Behavior

### Input

- Feature/Epic ID that was just implemented
- List of modified files (from task completion records)

### Process

1. **Gather context on what changed**:
   - Use `git diff main...HEAD` (or appropriate base) to see all changes
   - Retrieve the feature/epic from Trellis to understand scope
   - Get list of all modified files from child tasks

2. **Analyze documentation impact**:
   - Check if any documented behaviors have changed
   - Check if any APIs, configurations, or usage patterns have changed
   - Check if any new features need documentation

3. **Identify documentation files to update**:
   - `CLAUDE.md` - Project instructions for Claude Code
   - `README.md` - Project readme
   - `docs/**` - Any files in docs folder

4. **Make documentation updates directly**:
   - Use Edit/Write tools to update documentation
   - Keep updates focused and relevant to the changes made
   - Follow existing documentation style and format

5. **Return summary**:
   - List of files updated with brief description of changes
   - Or "No documentation updates needed" if no changes required

### Output Format

```
## Documentation Updates

### Files Updated
- `README.md`: Added section on new authentication flow
- `docs/api.md`: Updated endpoint documentation for /users

### Summary
[Brief description of what was documented and why]
```

Or if no updates needed:

```
## Documentation Updates

No documentation updates needed. The changes made do not affect any documented behaviors, APIs, or usage patterns.
```

## Acceptance Criteria

- [ ] Skill file created at `plugins/task-trellis/skills/docs-updater/SKILL.md`
- [ ] Proper frontmatter with `context: fork` and appropriate tools
- [ ] Reviews git diff to understand what changed
- [ ] Identifies which docs need updates (CLAUDE.md, README.md, docs/)
- [ ] Makes documentation updates directly using Edit/Write
- [ ] Returns summary of changes or "no updates needed"

## Technical Notes

- Pattern after existing forked skills like `issue-implementation-review`
- Use Bash for git commands to get diff information
- The skill runs as a subagent so it cannot ask questions—must make reasonable judgments or note uncertainties in output