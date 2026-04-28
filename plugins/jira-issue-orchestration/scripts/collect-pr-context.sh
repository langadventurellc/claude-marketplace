#!/usr/bin/env bash
set -uo pipefail

DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)

printf "PR runtime context (snapshotted at skill-load time). Use this directly for all read-only inspection in steps 1–5. After step 6 (commit) or step 7 (push), re-issue git status / git log yourself — this snapshot does not update.\n\n"

printf "## Default branch\n\n"
printf "%s\n\n" "$DEFAULT_BRANCH"

printf "## Working tree status\n\n"
printf '```text\n'
git status --porcelain=v1 -b
printf '```\n\n'

printf "## Pending change summary\n\n"
printf '```text\n'
git diff "$DEFAULT_BRANCH"...HEAD --stat
git diff --stat
git diff --cached --stat
printf '```\n\n'

printf "## Files in the PR's change set\n\n"
printf '```text\n'
git diff "$DEFAULT_BRANCH"...HEAD --name-only
git status --porcelain=v1
printf '```\n\n'

printf "## Full diff vs. default branch\n\n"
printf '```diff\n'
_tmp=$(mktemp)
git diff "$DEFAULT_BRANCH"...HEAD > "$_tmp"
head -n 500 "$_tmp"
_total=$(wc -l < "$_tmp")
rm -f "$_tmp"
if [ "$_total" -gt 500 ]; then
  printf "\n[diff truncated at 500 lines — %d total]\n" "$_total"
fi
printf '```\n\n'

printf "## Commit messages with bodies\n\n"
printf '```text\n'
git log "$DEFAULT_BRANCH"..HEAD --format='%h %s%n%b%n---'
printf '```\n'
