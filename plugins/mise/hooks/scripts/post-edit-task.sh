#!/bin/bash

# Post-tool use hook for file edits
# Runs lint and type-check after editing files

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
    local line_count
    line_count=$(echo "$1" | wc -l)
    if [ "$line_count" -gt "$MAX_LINES" ]; then
        echo "$1" | head -n "$MAX_LINES"
        echo "... (truncated, showing first $MAX_LINES of $line_count lines)"
    else
        echo "$1"
    fi
}

echo "🔧 Running post-edit checks..."

echo "📝 Running lint checks..."
LINT_OUTPUT=$(mise run lint 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ Lint checks failed - consider fixing issues before continuing" >&2
    FILTERED=$(echo "$LINT_OUTPUT" | grep -E "(error|warning)")
    limit_output "$FILTERED" >&2
    exit 2
fi

echo "✅ Lint checks passed"

echo "📝 Running type checks..."
TYPE_OUTPUT=$(mise run type-check 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ Type checks failed - consider fixing issues before continuing" >&2
    FILTERED=$(echo "$TYPE_OUTPUT" | grep -E "(error|warning)")
    limit_output "$FILTERED" >&2
    exit 2
fi

echo "✅ Type checks passed"
exit 0
