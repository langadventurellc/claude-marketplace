#!/bin/bash

# Post-tool use hook for file edits
# Runs lint and type-check after editing files

set -euo pipefail
trap 'rc=$?; echo "" >&2; echo "❌ Mise hook script failed unexpectedly (exit $rc near line $LINENO)." >&2; echo "There is a problem with the hooks themselves — not with your code changes." >&2; echo "STOP IMMEDIATELY, inform the user, and wait for direction before continuing." >&2; exit 2' ERR

# Limit output to prevent overwhelming the context window
MAX_LINES=100

# Only run in git repos with mise configured
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

# Skip if no mise config
if [ ! -f ".mise.toml" ] && [ ! -f "mise.toml" ] && [ ! -f ".tool-versions" ]; then
    exit 0
fi

# Helper function to limit output
limit_output() {
    local content="$1"
    local line_count
    line_count=$(wc -l <<< "$content")
    if [ "$line_count" -gt "$MAX_LINES" ]; then
        head -n "$MAX_LINES" <<< "$content"
        echo "... (truncated, showing first $MAX_LINES of $line_count lines)"
    else
        echo "$content"
    fi
}

# Standard agent-facing failure preamble for handled check failures
print_failure() {
    local check_name="$1"
    {
        echo "❌ ${check_name} failed."
        echo "  • Consider fixing the issues before continuing — they may be caused by your recent changes."
        echo "  • If the problem persists or seems unrelated to your changes, STOP IMMEDIATELY, inform the user, and wait for direction."
        echo "  • After fixing, continue with your original task — do not stop just because this hook fired."
    } >&2
}

echo "🔧 Running post-edit checks..."

echo "📝 Running lint checks..."
LINT_OUTPUT=$(mise run lint 2>&1) || {
    print_failure "Lint checks"
    FILTERED=$(grep -E "(error|warning)" <<< "$LINT_OUTPUT" || true)
    limit_output "$FILTERED" >&2
    exit 2
}

echo "✅ Lint checks passed"

echo "📝 Running type checks..."
TYPE_OUTPUT=$(mise run type-check 2>&1) || {
    print_failure "Type checks"
    FILTERED=$(grep -E "(error|warning)" <<< "$TYPE_OUTPUT" || true)
    limit_output "$FILTERED" >&2
    exit 2
}

echo "✅ Type checks passed"
exit 0
