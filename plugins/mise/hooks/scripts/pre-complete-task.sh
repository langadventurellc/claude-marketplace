#!/bin/bash

# Pre-tool use hook for Trellis Complete Task
# Runs quality checks and tests before completing tasks

set -euo pipefail
trap 'rc=$?; echo "" >&2; echo "❌ Mise hook script failed unexpectedly (exit $rc near line $LINENO)." >&2; echo "There is a problem with the hooks themselves — not with your code changes." >&2; echo "stop immediately, inform the user, and wait for direction before continuing." >&2; exit 2' ERR

# Limit output to prevent overwhelming the context window
MAX_LINES=25

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
        echo "  • If the problem persists or seems unrelated to your changes, stop immediately, inform the user, and wait for direction."
        echo "  • After fixing, continue with your original task — do not stop just because this hook fired."
    } >&2
}

echo "🔧 Running pre-completion checks for Trellis task..."

echo "📝 Running quality checks..."
QUALITY_OUTPUT=$(mise run quality 2>&1) || {
    print_failure "Quality checks"
    limit_output "$QUALITY_OUTPUT" >&2
    exit 2
}

echo "✅ Quality checks passed"

echo "🧪 Running tests..."
TEST_OUTPUT=$(mise run test 2>&1) || {
    print_failure "Tests"
    limit_output "$TEST_OUTPUT" >&2
    exit 2
}

echo "✅ Tests passed"
echo "🎉 Pre-completion checks successful - proceeding with task completion"
exit 0
