#!/bin/bash

# Pre-tool use hook for Trellis Complete Task
# Runs quality checks and tests before completing tasks

# Only run in git repos with mise configured
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

# Skip if no mise config
if [ ! -f ".mise.toml" ] && [ ! -f "mise.toml" ] && [ ! -f ".tool-versions" ]; then
    exit 0
fi

echo "🔧 Running pre-completion checks for Trellis task..."

echo "📝 Running quality checks..."
if ! mise run quality; then
    echo "❌ Quality checks failed - fix issues before completing task" >&2
    exit 2
fi

echo "✅ Quality checks passed"

echo "🧪 Running tests..."
if ! mise run test; then
    echo "❌ Tests failed - fix issues before completing task" >&2
    exit 2
fi

echo "✅ Tests passed"
echo "🎉 Pre-completion checks successful - proceeding with task completion"
exit 0