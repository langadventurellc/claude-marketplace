#!/bin/bash
# Probes the Task Trellis UI port and, if reachable, emits:
#   - a user-visible banner via `systemMessage`
#   - model-only context via `hookSpecificOutput.additionalContext`
# Silently no-ops if curl is missing or the UI is unreachable.

PORT="${TRELLIS_UI_PORT:-3717}"
ROOT_URL="http://127.0.0.1:${PORT}"

if ! command -v curl >/dev/null 2>&1; then
  exit 0
fi
if ! curl -sf --max-time 1 "${ROOT_URL}" >/dev/null 2>&1; then
  exit 0
fi

# Compute the 12-char project key the same way the MCP server does:
# sha1(git_origin_url || absolute_pwd), first 12 hex chars.
LABEL=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$LABEL" ]; then
  LABEL="$(pwd)"
fi

if command -v shasum >/dev/null 2>&1; then
  KEY=$(printf '%s' "$LABEL" | shasum -a 1 | awk '{print $1}' | cut -c1-12)
elif command -v sha1sum >/dev/null 2>&1; then
  KEY=$(printf '%s' "$LABEL" | sha1sum | awk '{print $1}' | cut -c1-12)
else
  KEY=""
fi

if [ -n "$KEY" ]; then
  PROJECT_URL="${ROOT_URL}/projects/${KEY}"
else
  PROJECT_URL="${ROOT_URL}"
fi

printf '{"systemMessage":"Task Trellis UI: %s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"The Task Trellis browser UI is running at %s. When the user asks about the UI, where to view issues in a browser, or asks you to open the UI, mention this URL and offer to open it with the /task-trellis-teams:open-ui command."}}\n' "${PROJECT_URL}" "${PROJECT_URL}"

exit 0
