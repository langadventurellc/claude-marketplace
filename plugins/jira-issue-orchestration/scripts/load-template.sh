#!/usr/bin/env bash
set -euo pipefail

override="${TT_JIRA_TEMPLATE:-}"
default_doc="$1"

if [[ -n "$override" && -r "$override" ]]; then
  printf 'A custom Jira issue template has been provided. Follow it verbatim:\n\n---\n'
  cat "$override"
  printf '\n---\n'
else
  cat "$default_doc"
fi
