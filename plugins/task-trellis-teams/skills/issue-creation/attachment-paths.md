# Attachment Path Reference

`Read` and `Glob` do not expand `~`, `$HOME`, `$TRELLIS_DATA_DIR`, or `${TRELLIS_DATA_DIR:-...}`. Every attachment path that ends up in an issue body must already be a literal absolute path like `/Users/<you>/.trellis/projects/114d2168e23e/f/F-foo/attachments/spec.md`.

## Materializing the absolute path after `add_attachment`

After `add_attachment` succeeds, run one Bash call to locate the file the MCP just copied. `find` does not depend on knowing the holder hierarchy segments (which differ for project / epic / feature / task and for open vs. closed task buckets):

```
bash -c 'find "${TRELLIS_DATA_DIR:-$HOME/.trellis}/projects/<projectKey>" -path "*/<holder-id>/attachments/<filename>"'
```

The single line of stdout is the absolute path. Paste it verbatim into the body's `## Attachments` section. Do not re-introduce `~` or `${…}` when writing it back — the readers (reviewer, developer, implementation reviewer) call `Read` directly on whatever string is in the body.

## Finding `<projectKey>`

Read it from the SessionStart hook context already injected into your session. The hook emits a line like:

```
The Task Trellis browser UI is running at http://127.0.0.1:<port>/projects/<projectKey>.
```

`<projectKey>` is the 12-character segment after `/projects/`. It matches the directory name under `${TRELLIS_DATA_DIR:-$HOME/.trellis}/projects/` exactly.

## Confirming attachments exist on a holder (readers)

`mcp__plugin_task-trellis-teams_task-trellis__get_issue` returns a top-level `attachments` array of filenames on the holder issue — this is the authoritative list, independent of whatever the body's `## Attachments` section says. When a child references attachments on a parent holder, the child's own `attachments` array is empty; fetch the holder via `get_issue` to read the array.
