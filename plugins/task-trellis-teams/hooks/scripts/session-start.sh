#!/bin/bash
# Probes the Task Trellis UI port and injects additionalContext if reachable.
# SessionStart stdout is injected into model context only — not user-visible.

PORT="${TRELLIS_UI_PORT:-3717}"
URL="http://127.0.0.1:${PORT}"

# Probe with a 1-second timeout; silently no-op if unreachable or curl missing
if ! command -v curl >/dev/null 2>&1; then
  exit 0
fi

if curl -sf --max-time 1 "${URL}" >/dev/null 2>&1; then
  printf '{"additionalContext":"The Task Trellis browser UI is running at %s. When the user asks about the UI, where to view issues in a browser, or asks you to open the UI, mention this URL and offer to open it with the /task-trellis-teams:open-ui command."}\n' "${URL}"
fi

exit 0
