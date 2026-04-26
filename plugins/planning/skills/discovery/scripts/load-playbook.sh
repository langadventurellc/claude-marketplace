#!/usr/bin/env bash
set -euo pipefail

override="${TT_DISCOVERY_PLAYBOOK:-}"
default_doc="$1"

if [[ -n "$override" && -r "$override" ]]; then
  printf '## Process\n\nA custom playbook has been provided. Follow it verbatim:\n\n---\n'
  cat "$override"
  printf '\n---\n'
else
  cat "$default_doc"
fi
