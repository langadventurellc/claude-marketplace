#!/bin/bash

# Pre-tool use hook for Trellis Complete Task
# Runs quality checks and tests before completing tasks

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

echo "🔧 Running pre-completion checks for Trellis task..."

echo "📝 Running quality checks..."
QUALITY_OUTPUT=$(mise run quality 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ Quality checks failed - fix issues before completing task" >&2
    limit_output "$QUALITY_OUTPUT" >&2
    exit 2
fi

echo "✅ Quality checks passed"

echo "🧪 Running tests..."
TEST_OUTPUT=$(mise run test 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ Tests failed - fix issues before completing task" >&2
    limit_output "$TEST_OUTPUT" >&2
    exit 2
fi

echo "✅ Tests passed"
echo "🎉 Pre-completion checks successful - proceeding with task completion"
exit 0