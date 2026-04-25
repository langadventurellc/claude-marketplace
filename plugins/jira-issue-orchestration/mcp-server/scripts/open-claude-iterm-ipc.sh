#!/usr/bin/env bash
# Fire-and-forget launcher: opens a new iTerm window attached via `tmux -CC`
# to a fresh tmux session running `claude --dangerously-skip-permissions`,
# with an IPC preamble instructing the sub-instance to tail a conductor->sub
# log file via the Monitor tool and to send replies by appending to a
# sub->conductor log file.
#
# Usage: open-claude-iterm-ipc.sh <channel-id> <user-prompt> <session-name> <c2s-log> <s2c-log>
#
# IPC log paths are passed in by the MCP server (which owns path layout via
# ${CLAUDE_PLUGIN_DATA}). This script does not derive them itself.

set -u

channel_id="${1-}"
user_prompt="${2-}"
session_arg="${3-}"
c2s_log="${4-}"
s2c_log="${5-}"

if [[ -z "$channel_id" ]]; then
  echo "ERROR: channel-id required as first argument" >&2
  exit 1
fi
if [[ -z "$c2s_log" || -z "$s2c_log" ]]; then
  echo "ERROR: c2s-log and s2c-log paths required as args 4 and 5" >&2
  exit 1
fi

mkdir -p "$(dirname "$c2s_log")"
: >>"$c2s_log"
: >>"$s2c_log"

if [[ -n "$session_arg" ]]; then
  session="$session_arg"
else
  session="claude-$(date +%s)-$$-$RANDOM"
fi

plugin_data="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/jira-issue-orchestration}"
log_file="${plugin_data}/logs/open-claude-iterm.log"
mkdir -p "$(dirname "$log_file")"
log() { printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >>"$log_file"; }

# Resolve tmux to an absolute path. iTerm's `command "..."` parameter inherits
# a PATH that does not always include /opt/homebrew/bin (notably when iTerm is
# already running), so passing a bare `tmux` causes the spawned window to die
# with "tmux: command not found" and close immediately.
tmux_bin="$(command -v tmux || true)"
if [[ -z "$tmux_bin" ]]; then
  echo "ERROR: tmux not found on PATH" >&2
  log "ERROR: tmux not found on PATH"
  exit 1
fi

preamble=$(cat <<EOF
You are a spawned Claude Code sub-instance participating in a two-party IPC spike with a conductor Claude Code instance.

IPC contract:
- CHANNEL_ID=${channel_id}
- Conductor -> you: conductor appends lines to ${c2s_log}
- You -> conductor: use send-message-to-conductor({ channelId: CHANNEL_ID, message: "..." })

BEFORE DOING ANYTHING ELSE, perform these setup steps in order:
1. If the Monitor tool is not already loaded, load it via ToolSearch with query "select:Monitor".
2. Start a persistent Monitor (persistent: true, description like "conductor->sub IPC inbox") running exactly:
     tail -n 0 -F ${c2s_log}
   Each stdout line from that tail is an inbound message from the conductor.
3. Announce readiness by running this Bash command:
     printf '%s\n' "sub: hello conductor, IPC ready" >> ${s2c_log}

After setup, treat every Monitor event from the inbox as a message from the conductor and act on it. To reply, call send-message-to-conductor({ channelId: CHANNEL_ID, message: "sub: <your reply>" }).
Keep each message to a single line (no embedded newlines).

User prompt follows (may be empty for a bare spike):
${user_prompt}
EOF
)

{
  claude_cmd="claude --dangerously-skip-permissions $(printf %q "$preamble")"

  if ! "$tmux_bin" new-session -d -s "$session" "$claude_cmd" 2>>"$log_file"; then
    log "ERROR: tmux new-session failed for session=$session channel=$channel_id"
    exit 1
  fi
  log "Started tmux session=$session channel=$channel_id preamble_len=${#preamble} tmux_bin=$tmux_bin"

  osascript >>"$log_file" 2>&1 <<APPLESCRIPT
tell application "iTerm"
    activate
    create window with default profile command "${tmux_bin} -CC attach -t ${session}"
end tell
APPLESCRIPT
  log "Dispatched iTerm window for session=$session channel=$channel_id"
} >/dev/null 2>&1 &

disown
exit 0
