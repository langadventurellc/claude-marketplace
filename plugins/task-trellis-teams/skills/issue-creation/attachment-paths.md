# Attachment Path Reference

When writing `## Attachments` sections, use this on-disk path template:

```
${TRELLIS_DATA_DIR:-~/.trellis}/projects/<projectKey>/<holder-path>/<holder-id>/attachments/<filename>
```

`<holder-path>` reflects the hierarchy up to (but not including) the holder ID — `p/<project-id>/e/<epic-id>/f` for a feature under an epic, `f` for a standalone feature, etc. The type-specific files (`project.md`, `epic.md`, `feature.md`, `task.md`) show the exact path for each holder type.

## Finding `<projectKey>`

Call `mcp__plugin_task-trellis-teams_task-trellis__get_ui_info` and use the segment after `/projects/` in the returned `projectUrl`. It matches the directory name under `${TRELLIS_DATA_DIR:-~/.trellis}/projects/`.
