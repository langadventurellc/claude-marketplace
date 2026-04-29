#!/bin/bash

# PostToolUse hook for Edit/Write.
# Surfaces lint and type-check results to the model via `additionalContext`
# (a system reminder) on routine check failures, so the information arrives
# as context rather than as a tool error. Reserves exit-2 for genuine
# hook-internal failures the agent cannot resolve from the tool output.

set -euo pipefail
trap 'rc=$?; {
    echo ""
    echo "❌ Mise hook script failed unexpectedly (exit $rc near line $LINENO)."
    echo "There is a problem with the hooks themselves — not with your code changes."
    echo "Stop immediately, inform the user, and wait for direction before continuing."
} >&2; exit 2' ERR

MAX_LINES=25

# Status messages → stderr. Stderr is only piped to the model on exit 2,
# so these stay off the model's view on the happy path and the
# additionalContext path.
status() { echo "$@" >&2; }

# Only run in git repos with mise configured.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [ ! -f ".mise.toml" ] && [ ! -f "mise.toml" ] && [ ! -f ".tool-versions" ]; then
    exit 0
fi

command -v jq >/dev/null || {
    echo "Mise hook requires jq, which is not installed." >&2
    echo "Stop and inform the user that the dev environment is missing jq." >&2
    exit 2
}

limit_output() {
    local content="$1" line_count
    line_count=$(wc -l <<< "$content")
    if [ "$line_count" -gt "$MAX_LINES" ]; then
        head -n "$MAX_LINES" <<< "$content"
        echo "... (truncated, showing first $MAX_LINES of $line_count lines)"
    else
        echo "$content"
    fi
}

# Emit a PostToolUse system reminder. Phrased as factual statements per
# Claude Code hook guidance — imperative system instructions risk being
# treated as untrusted input rather than context.
emit_context() {
    printf '%s' "$1" | jq -Rs '{
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: .
        }
    }'
}

REPORT=""

status "🔧 Running post-edit checks..."

status "📝 Running lint checks..."
if LINT_OUTPUT=$(mise run lint 2>&1); then
    status "✅ Lint checks passed"
else
    FILTERED=$(grep -E "(error|warning)" <<< "$LINT_OUTPUT" || echo "$LINT_OUTPUT")
    REPORT+="Lint reports the following issues after the most recent edit:"$'\n'
    REPORT+="$(limit_output "$FILTERED")"$'\n\n'
fi

status "📝 Running type checks..."
if TYPE_OUTPUT=$(mise run type-check 2>&1); then
    status "✅ Type checks passed"
else
    FILTERED=$(grep -E "(error|warning)" <<< "$TYPE_OUTPUT" || echo "$TYPE_OUTPUT")
    REPORT+="Type-check reports the following issues after the most recent edit:"$'\n'
    REPORT+="$(limit_output "$FILTERED")"$'\n\n'
fi

if [ -n "$REPORT" ]; then
    REPORT+="These checks ran against the full repo and may include preexisting issues unrelated to this edit."
    emit_context "$REPORT"
fi

exit 0
