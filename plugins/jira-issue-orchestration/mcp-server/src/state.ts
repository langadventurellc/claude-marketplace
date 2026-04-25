import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

export interface ChannelState {
  channelId: string;
  tmuxSession: string | null;
  c2sLogPath: string;
  s2cLogPath: string;
}

const PLUGIN_DATA_ROOT =
  process.env.CLAUDE_PLUGIN_DATA ??
  path.join(os.homedir(), ".claude", "plugins", "data", "jira-issue-orchestration");
const STATE_FILE = path.join(PLUGIN_DATA_ROOT, "state.json");
const IPC_ROOT = path.join(PLUGIN_DATA_ROOT, "ipc");
const CHANNEL_ID_REGEX = /^\d+-[0-9a-f]+$/;

/** Returns true when `id` is a valid channel ID (epoch digits, hyphen, lowercase hex). Rejects path traversal, spaces, and uppercase. */
export function validateChannelId(id: string): boolean {
  return typeof id === "string" && CHANNEL_ID_REGEX.test(id);
}

/** Returns a unique channel ID in `<epoch>-<hex>` format, e.g. `1745433600-a3f9`. */
export function generateChannelId(): string {
  const epoch = Math.floor(Date.now() / 1000);
  const suffix = randomBytes(2).toString("hex");
  return `${epoch}-${suffix}`;
}

/** Returns the IPC directory path for `channelId`. Throws if the ID is invalid. */
export function ipcDir(channelId: string): string {
  if (!validateChannelId(channelId)) {
    throw new Error(`Invalid channel ID: ${channelId}`);
  }
  return path.join(IPC_ROOT, channelId);
}

/** Returns the conductor-to-sub log path for `channelId`. */
export function c2sLogPath(channelId: string): string {
  return path.join(ipcDir(channelId), "c2s.log");
}

/** Returns the sub-to-conductor log path for `channelId`. */
export function s2cLogPath(channelId: string): string {
  return path.join(ipcDir(channelId), "s2c.log");
}

/** Reads persisted channel state from `${CLAUDE_PLUGIN_DATA}/state.json`. Returns `null` when no state file exists. */
export function readState(): ChannelState | null {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw) as ChannelState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Persists channel state to `${CLAUDE_PLUGIN_DATA}/state.json`, creating the directory if needed. */
export function writeState(state: ChannelState): void {
  fs.mkdirSync(PLUGIN_DATA_ROOT, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

/** Removes the state file. Idempotent — no error if the file is already absent. */
export function clearState(): void {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
