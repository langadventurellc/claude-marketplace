import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  readMeta, writeMeta, deleteMeta, listChannels,
  generateChannelId, validateChannelId,
  ipcDir, c2sLogPath, s2cLogPath,
  type ChannelMeta,
  readConfig, writeConfig,
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

function requireChannelId(args: Record<string, unknown> | undefined): string | ToolResult {
  const channelId = typeof args?.channelId === "string" ? args.channelId : null;
  if (channelId === null) return toolError("channelId argument is required and must be a string.");
  if (!validateChannelId(channelId)) return toolError(`Invalid channelId: ${channelId}`);
  return channelId;
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "claim-conductor",
    description:
      "Register this Claude instance as the conductor for a new channel. Returns a channel ID and IPC log paths. Each call creates a fresh independent channel. You MUST arm a persistent Monitor on s2cLogPath before calling launch-orchestration-team.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Optional human-readable label for this channel (e.g. \"KAN-1\")." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "launch-orchestration-team",
    description:
      "Launch a sub Claude instance in a new terminal/tmux window for the given channel. Fails if the channel is unknown or a sub is already active. PREREQUISITE: arm Monitor on s2cLogPath first.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID returned by claim-conductor." },
        prompt: { type: "string", description: "Optional user prompt to pass to the sub instance." },
      },
      required: ["channelId"],
      additionalProperties: false,
    },
  },
  {
    name: "stop-orchestration-team",
    description:
      "Stop the named orchestration channel: send __peer_exit__ sentinel, kill tmux session, remove IPC directory, and delete meta. Only the named channel is affected. Idempotent.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID to stop." },
      },
      required: ["channelId"],
      additionalProperties: false,
    },
  },
  {
    name: "send-message-to-orchestration-team",
    description:
      "Append a single-line message to the conductor→sub IPC log (c2s.log) for the given channel. Rejects multi-line messages.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID to send the message to." },
        message: { type: "string", description: "Single-line message to send to the orchestration team." },
      },
      required: ["channelId", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "send-message-to-conductor",
    description:
      "Append a single-line message to the sub→conductor IPC log (s2c.log) for the given channel. Fails if the channel is unknown.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID to send the message on." },
        message: { type: "string", description: "Single-line message to send to the conductor." },
      },
      required: ["channelId", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "terminate-sub",
    description:
      "Terminate the active sub for the given channel (sends __peer_exit__, kills tmux) without destroying the channel directory, log files, or meta. Idempotent — safe to call even when no sub is active.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID whose sub should be terminated." },
      },
      required: ["channelId"],
      additionalProperties: false,
    },
  },
  {
    name: "list-channels",
    description:
      "List all existing IPC channels with their metadata (channelId, label, createdAt, tmuxSession, log paths).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get-config",
    description:
      "Return the persisted per-project configuration values for the current working directory. Returns `{ values: {} }` when no config has been written yet. Project identity is derived server-side from process.cwd().",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set-config",
    description:
      "Merge the supplied string-valued keys into the persisted per-project config for the current working directory. Existing keys not in `values` are preserved; matching keys are overwritten. Returns merged values and the absolute file path.",
    inputSchema: {
      type: "object",
      properties: {
        values: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Key-value pairs to merge into the config. All values must be strings.",
        },
      },
      required: ["values"],
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
    case "claim-conductor":                    return claimConductor(args);
    case "launch-orchestration-team":          return launchOrchestrationTeam(args);
    case "stop-orchestration-team":            return stopOrchestrationTeam(args);
    case "send-message-to-orchestration-team": return sendMessageToOrchestrationTeam(args);
    case "send-message-to-conductor":          return sendMessageToConductor(args);
    case "terminate-sub":                      return terminateSub(args);
    case "list-channels":                      return listChannelsHandler();
    case "get-config":                         return getConfigHandler();
    case "set-config":                         return setConfigHandler(args);
    default:                                   return toolError(`Unknown tool: ${name}`);
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

function claimConductor(args: Record<string, unknown> | undefined): ToolResult {
  const label = typeof args?.label === "string" ? args.label : undefined;
  const channelId = generateChannelId();
  const dir = ipcDir(channelId);
  fs.mkdirSync(dir, { recursive: true });
  const c2s = c2sLogPath(channelId);
  const s2c = s2cLogPath(channelId);
  fs.closeSync(fs.openSync(c2s, "a"));
  fs.closeSync(fs.openSync(s2c, "a"));
  const meta: ChannelMeta = {
    channelId,
    tmuxSession: null,
    c2sLogPath: c2s,
    s2cLogPath: s2c,
    createdAt: new Date().toISOString(),
  };
  if (label !== undefined) meta.label = label;
  writeMeta(channelId, meta);
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
  const chId = requireChannelId(args);
  if (typeof chId !== "string") return chId;
  const prompt = typeof args?.prompt === "string" ? args.prompt : "";
  const meta = readMeta(chId);
  if (meta === null) {
    return toolError(`channel \`${chId}\` not found. Call claim-conductor first.`);
  }
  if (meta.tmuxSession !== null) {
    return toolError(
      `sub already active in channel \`${chId}\` (tmux session ${meta.tmuxSession}). Call terminate-sub before launching another.`
    );
  }
  const sessionName = generateTmuxSessionName();
  const scriptPath = path.resolve(import.meta.dirname, "../scripts/open-claude-tmux-ipc.sh");
  if (!fs.existsSync(scriptPath)) {
    return toolError(`Launcher script missing at ${scriptPath}`);
  }
  const child = spawn(
    scriptPath,
    [chId, prompt, sessionName, meta.c2sLogPath, meta.s2cLogPath],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
  writeMeta(chId, { ...meta, tmuxSession: sessionName });
  return toolOk({ tmuxSession: sessionName, channelId: chId, prompt });
}

function stopOrchestrationTeam(args: Record<string, unknown> | undefined): ToolResult {
  const chId = requireChannelId(args);
  if (typeof chId !== "string") return chId;
  const meta = readMeta(chId);
  if (meta === null) {
    return toolOk({ stopped: false, channelId: chId, reason: "channel not found; nothing to stop." });
  }
  try { fs.appendFileSync(meta.c2sLogPath, "__peer_exit__\n"); } catch { /* swallow */ }
  if (meta.tmuxSession) {
    try { execSync(`tmux kill-session -t ${JSON.stringify(meta.tmuxSession)}`, { stdio: "ignore" }); } catch { /* already gone */ }
  }
  try { fs.rmSync(ipcDir(chId), { recursive: true, force: true }); } catch { /* swallow */ }
  deleteMeta(chId);
  return toolOk({ stopped: true, channelId: chId, tmuxSession: meta.tmuxSession });
}

function sendMessageToOrchestrationTeam(args: Record<string, unknown> | undefined): ToolResult {
  const chId = requireChannelId(args);
  if (typeof chId !== "string") return chId;
  const message = typeof args?.message === "string" ? args.message : null;
  if (message === null) return toolError("message argument is required and must be a string.");
  if (message.includes("\n") || message.includes("\r")) {
    return toolError("message must not contain newline characters; IPC is single-line.");
  }
  const meta = readMeta(chId);
  if (meta === null || meta.tmuxSession === null) {
    return toolError(`no sub active in channel \`${chId}\`. Call launch-orchestration-team first.`);
  }
  fs.appendFileSync(meta.c2sLogPath, message + "\n");
  return toolOk({ sent: true, bytes: Buffer.byteLength(message) + 1 });
}

function sendMessageToConductor(args: Record<string, unknown> | undefined): ToolResult {
  const chId = requireChannelId(args);
  if (typeof chId !== "string") return chId;
  const message = typeof args?.message === "string" ? args.message : null;
  if (message === null) return toolError("message argument is required and must be a string.");
  if (message.includes("\n") || message.includes("\r")) {
    return toolError("message must not contain newline characters; IPC is single-line.");
  }
  const meta = readMeta(chId);
  if (meta === null) {
    return toolError(`channel \`${chId}\` not found. Call claim-conductor first.`);
  }
  fs.appendFileSync(meta.s2cLogPath, message + "\n");
  return toolOk({ sent: true, bytes: Buffer.byteLength(message) + 1 });
}

function terminateSub(args: Record<string, unknown> | undefined): ToolResult {
  const chId = requireChannelId(args);
  if (typeof chId !== "string") return chId;
  const meta = readMeta(chId);
  if (meta === null) {
    return toolOk({ terminated: false, channelId: chId, reason: "channel not found; nothing to terminate." });
  }
  const previousTmuxSession = meta.tmuxSession;
  try { fs.appendFileSync(meta.c2sLogPath, "__peer_exit__\n"); } catch { /* swallow */ }
  if (meta.tmuxSession) {
    try { execSync(`tmux kill-session -t ${JSON.stringify(meta.tmuxSession)}`, { stdio: "ignore" }); } catch { /* already gone */ }
  }
  writeMeta(chId, { ...meta, tmuxSession: null });
  return toolOk({ terminated: true, channelId: chId, previousTmuxSession });
}

function listChannelsHandler(): ToolResult {
  return toolOk(listChannels());
}

function getConfigHandler(): ToolResult {
  try {
    const state = readConfig();
    return toolOk({ values: state.values });
  } catch (err) {
    return toolError(`get-config failed: ${String(err)}`);
  }
}

function setConfigHandler(args: Record<string, unknown> | undefined): ToolResult {
  const raw = args?.values;
  if (raw === null || raw === undefined) return toolError("values argument is required.");
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return toolError("values must be a plain object.");
  }
  const values = raw as Record<string, unknown>;
  for (const [k, v] of Object.entries(values)) {
    if (typeof v !== "string") {
      return toolError(`values["${k}"] must be a string, got ${typeof v}.`);
    }
  }
  try {
    const p = writeConfig(values as Record<string, string>);
    const state = readConfig();
    return toolOk({ values: state.values, path: p });
  } catch (err) {
    return toolError(`set-config failed: ${String(err)}`);
  }
}
