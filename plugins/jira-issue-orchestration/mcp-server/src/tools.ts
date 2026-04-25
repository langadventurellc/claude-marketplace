import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  readState, writeState, clearState,
  generateChannelId, validateChannelId,
  ipcDir, c2sLogPath, s2cLogPath,
} from "./state.ts";

// ── Helpers ─────────────────────────────────────────────────────────────────

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function toolOk(payload: string | object): ToolResult {
  return { content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }] };
}

function toolError(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function generateTmuxSessionName(): string {
  return `claude-${Math.floor(Date.now() / 1000)}-${process.pid}-${randomBytes(2).toString("hex")}`;
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "claim-conductor",
    description:
      "Register this Claude instance as the active conductor. Returns a channel ID and IPC log paths. You MUST arm a persistent Monitor on s2cLogPath before calling launch-orchestration-team.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "launch-orchestration-team",
    description:
      "Launch a sub Claude instance in a new iTerm/tmux window. Fails if no conductor is claimed or a sub is already active. PREREQUISITE: arm Monitor on s2cLogPath first.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Optional user prompt to pass to the sub instance." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "stop-orchestration-team",
    description:
      "Stop the active orchestration team: send __peer_exit__ sentinel, kill tmux session, remove IPC directory, and clear state. Idempotent.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "send-message-to-orchestration-team",
    description:
      "Append a single-line message to the conductor→sub IPC log (c2s.log). Rejects multi-line messages.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Single-line message to send to the orchestration team." },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
  {
    name: "send-message-to-conductor",
    description:
      "Append a single-line message to the sub→conductor IPC log (s2c.log). Fails if no conductor is claimed.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Single-line message to send to the conductor." },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
];

// ── Dispatcher ───────────────────────────────────────────────────────────────

/** Routes an incoming MCP tool call to the matching handler. */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<ToolResult> {
  switch (name) {
    case "claim-conductor":                  return claimConductor();
    case "launch-orchestration-team":        return launchOrchestrationTeam(args);
    case "stop-orchestration-team":          return stopOrchestrationTeam();
    case "send-message-to-orchestration-team": return sendMessageToOrchestrationTeam(args);
    case "send-message-to-conductor":        return sendMessageToConductor(args);
    default:                                 return toolError(`Unknown tool: ${name}`);
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

function claimConductor(): ToolResult {
  const existing = readState();
  if (existing !== null) {
    return toolError(
      `Conductor already claimed for channel ${existing.channelId}. Call stop-orchestration-team to release it.`
    );
  }
  const channelId = generateChannelId();
  const dir = ipcDir(channelId);
  fs.mkdirSync(dir, { recursive: true });
  const c2s = c2sLogPath(channelId);
  const s2c = s2cLogPath(channelId);
  fs.closeSync(fs.openSync(c2s, "a"));
  fs.closeSync(fs.openSync(s2c, "a"));
  writeState({ channelId, tmuxSession: null, c2sLogPath: c2s, s2cLogPath: s2c });
  return toolOk({
    channelId,
    c2sLogPath: c2s,
    s2cLogPath: s2c,
    instruction:
      "Arm a persistent Monitor on s2cLogPath with 'tail -n 0 -F <s2cLogPath>' BEFORE calling launch-orchestration-team. " +
      "tail -n 0 -F drops all lines written before the tail is armed; skipping this step silently loses the sub's hello handshake.",
  });
}

function launchOrchestrationTeam(args: Record<string, unknown> | undefined): ToolResult {
  const prompt = typeof args?.prompt === "string" ? args.prompt : "";
  const state = readState();
  if (state === null) {
    return toolError("No conductor claimed. Call claim-conductor first.");
  }
  if (state.tmuxSession !== null) {
    return toolError(
      `Orchestration team already active (tmux session ${state.tmuxSession}). Call stop-orchestration-team before launching another.`
    );
  }
  if (!validateChannelId(state.channelId)) {
    return toolError("State file has invalid channelId; refusing to construct filesystem paths.");
  }
  const sessionName = generateTmuxSessionName();
  const scriptPath = path.resolve(import.meta.dirname, "../scripts/open-claude-iterm-ipc.sh");
  if (!fs.existsSync(scriptPath)) {
    return toolError(`Launcher script missing at ${scriptPath}`);
  }
  const child = spawn(scriptPath, [state.channelId, prompt, sessionName], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  writeState({ ...state, tmuxSession: sessionName });
  return toolOk({ tmuxSession: sessionName, channelId: state.channelId, prompt });
}

function stopOrchestrationTeam(): ToolResult {
  const state = readState();
  if (state === null) {
    return toolOk({ stopped: false, reason: "No active state. Nothing to stop." });
  }
  if (!validateChannelId(state.channelId)) {
    clearState();
    return toolOk({ stopped: true, note: "State had invalid channelId; cleared without filesystem cleanup." });
  }
  try { fs.appendFileSync(state.c2sLogPath, "__peer_exit__\n"); } catch { /* swallow */ }
  if (state.tmuxSession) {
    try { execSync(`tmux kill-session -t ${JSON.stringify(state.tmuxSession)}`, { stdio: "ignore" }); } catch { /* already gone */ }
  }
  try { fs.rmSync(ipcDir(state.channelId), { recursive: true, force: true }); } catch { /* swallow */ }
  clearState();
  return toolOk({ stopped: true, channelId: state.channelId, tmuxSession: state.tmuxSession });
}

function sendMessageToOrchestrationTeam(args: Record<string, unknown> | undefined): ToolResult {
  const message = typeof args?.message === "string" ? args.message : null;
  if (message === null) return toolError("message argument is required and must be a string.");
  if (message.includes("\n") || message.includes("\r")) {
    return toolError("message must not contain newline characters; IPC is single-line.");
  }
  const state = readState();
  if (state === null || state.tmuxSession === null) {
    return toolError("No orchestration team active. Call launch-orchestration-team first.");
  }
  if (!validateChannelId(state.channelId)) {
    return toolError("State file has invalid channelId; refusing to write.");
  }
  fs.appendFileSync(state.c2sLogPath, message + "\n");
  return toolOk({ sent: true, bytes: Buffer.byteLength(message) + 1 });
}

function sendMessageToConductor(args: Record<string, unknown> | undefined): ToolResult {
  const message = typeof args?.message === "string" ? args.message : null;
  if (message === null) return toolError("message argument is required and must be a string.");
  if (message.includes("\n") || message.includes("\r")) {
    return toolError("message must not contain newline characters; IPC is single-line.");
  }
  const state = readState();
  if (state === null) {
    return toolError("No conductor claimed. Call claim-conductor before sending messages to the conductor.");
  }
  if (!validateChannelId(state.channelId)) {
    return toolError("State file has invalid channelId; refusing to write.");
  }
  fs.appendFileSync(state.s2cLogPath, message + "\n");
  return toolOk({ sent: true, bytes: Buffer.byteLength(message) + 1 });
}
