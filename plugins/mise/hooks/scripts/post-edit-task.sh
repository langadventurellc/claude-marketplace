#!/bin/bash

# PostToolUse hook for Edit/Write.
# Lints only the file that was just edited so concurrent agents don't trip
# over each other's in-flight changes. Surfaces lint results to the model
# via `additionalContext` (a system reminder), reserving exit-2 for genuine
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
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT"

if [ ! -f ".mise.toml" ] && [ ! -f "mise.toml" ] && [ ! -f ".tool-versions" ]; then
    exit 0
fi

command -v jq >/dev/null || {
    echo "Mise hook requires jq, which is not installed." >&2
    echo "Stop and inform the user that the dev environment is missing jq." >&2
    exit 2
}

# Read hook payload from stdin and extract the edited file path.
# Exit silently if no path is available — nothing to scope the check to.
HOOK_INPUT=$(cat)
FILE_PATH=$(jq -r '.tool_input.file_path // empty' <<< "$HOOK_INPUT")
[ -n "$FILE_PATH" ] || exit 0

# Resolve to a path relative to the repo root.
case "$FILE_PATH" in
    /*) REL_PATH="${FILE_PATH#$REPO_ROOT/}" ;;
    *)  REL_PATH="$FILE_PATH" ;;
esac

# Only the MCP server has lint configured; skip anything outside it
# or non-TypeScript files.
MCP_PREFIX="plugins/jira-issue-orchestration/mcp-server/"
case "$REL_PATH" in
    "${MCP_PREFIX}src/"*.ts) ;;
    *) exit 0 ;;
esac

# File must still exist (an edit could be a deletion-style rewrite).
[ -f "$REL_PATH" ] || exit 0

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

emit_context() {
    printf '%s' "$1" | jq -Rs '{
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: .
        }
    }'
}

status "🔧 Linting $REL_PATH..."

# eslint resolves patterns relative to cwd, so run it from the MCP server dir
# and target the file with a path relative to that dir.
ESLINT_TARGET="${REL_PATH#$MCP_PREFIX}"

if LINT_OUTPUT=$(cd "$MCP_PREFIX" && npm exec --silent -- eslint "$ESLINT_TARGET" 2>&1); then
    status "✅ Lint passed"
    exit 0
fi

FILTERED=$(grep -E "(error|warning)" <<< "$LINT_OUTPUT" || echo "$LINT_OUTPUT")
REPORT="Lint reports the following issues in $REL_PATH after the most recent edit:"$'\n'
REPORT+="$(limit_output "$FILTERED")"
emit_context "$REPORT"

exit 0
