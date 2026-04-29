# Attachment Path Reference

When writing `## Attachments` sections, use this on-disk path template:

```
${TRELLIS_DATA_DIR:-~/.trellis}/projects/<projectKey>/<holder-path>/<holder-id>/attachments/<filename>
```

`<holder-path>` reflects the hierarchy up to (but not including) the holder ID — `p/<project-id>/e/<epic-id>/f` for a feature under an epic, `f` for a standalone feature, etc. The type-specific files (`project.md`, `epic.md`, `feature.md`, `task.md`) show the exact path for each holder type.

## Finding `<projectKey>`

Read it from the SessionStart hook context already injected into your session. The hook emits a line like:

```
The Task Trellis browser UI is running at http://127.0.0.1:<port>/projects/<projectKey>.
```

`<projectKey>` is the 12-character segment after `/projects/`. It matches the directory name under `${TRELLIS_DATA_DIR:-~/.trellis}/projects/` exactly.
