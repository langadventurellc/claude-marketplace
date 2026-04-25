import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash, randomBytes } from "node:crypto";

export interface ChannelMeta {
  channelId: string;
  tmuxSession: string | null;
  c2sLogPath: string;
  s2cLogPath: string;
  createdAt: string;
  label?: string;
}

export interface ConfigState {
  cwd: string;
  values: Record<string, string>;
}

const PLUGIN_DATA_ROOT =
  process.env.CLAUDE_PLUGIN_DATA ??
  path.join(os.homedir(), ".claude", "plugins", "data", "jira-issue-orchestration");
const IPC_ROOT = path.join(PLUGIN_DATA_ROOT, "ipc");
const CONFIG_ROOT = path.join(PLUGIN_DATA_ROOT, "configs");
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

function metaPath(channelId: string): string {
  return path.join(ipcDir(channelId), "meta.json");
}

/** Reads ipc/<channelId>/meta.json. Returns null when absent. Rethrows non-ENOENT errors. */
export function readMeta(channelId: string): ChannelMeta | null {
  try {
    const raw = fs.readFileSync(metaPath(channelId), "utf8");
    return JSON.parse(raw) as ChannelMeta;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Writes ipc/<channelId>/meta.json (pretty-printed). Creates channel directory if needed. */
export function writeMeta(channelId: string, meta: ChannelMeta): void {
  fs.mkdirSync(ipcDir(channelId), { recursive: true });
  fs.writeFileSync(metaPath(channelId), JSON.stringify(meta, null, 2), "utf8");
}

/** Removes ipc/<channelId>/meta.json. Idempotent — no error if absent. Does not remove the channel directory or log files. */
export function deleteMeta(channelId: string): void {
  try {
    fs.unlinkSync(metaPath(channelId));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Returns metadata for every channel with a valid ipc/<channelId>/meta.json.
 *  Silently skips dirs with missing or corrupt meta.json. Returns [] when IPC root absent. */
export function listChannels(): ChannelMeta[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(IPC_ROOT, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const result: ChannelMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !validateChannelId(entry.name)) continue;
    try {
      const meta = readMeta(entry.name);
      if (meta !== null) result.push(meta);
    } catch {
      /* skip entries with corrupt or unreadable meta.json */
    }
  }
  return result;
}

/** Returns a 12-char hex project key derived from sha256(process.cwd()). */
export function projectKey(): string {
  return createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12);
}

/** Returns the absolute config file path for `key` under `<PLUGIN_DATA_ROOT>/configs/`. */
export function configPath(key: string): string {
  return path.join(CONFIG_ROOT, `${key}.json`);
}

/** Reads the config for the current cwd. Returns `{ cwd, values: {} }` when no file exists. */
export function readConfig(): ConfigState {
  try {
    const raw = fs.readFileSync(configPath(projectKey()), "utf8");
    const parsed = JSON.parse(raw) as Partial<ConfigState>;
    const values =
      parsed.values && typeof parsed.values === "object" && !Array.isArray(parsed.values)
        ? (parsed.values as Record<string, string>)
        : {};
    return { cwd: process.cwd(), values };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { cwd: process.cwd(), values: {} };
    throw err;
  }
}

/** Merges `values` into the current cwd's config. Creates configs directory if needed. Returns the absolute file path. */
export function writeConfig(values: Record<string, string>): string {
  const existing = readConfig();
  const merged: ConfigState = { cwd: process.cwd(), values: { ...existing.values, ...values } };
  fs.mkdirSync(CONFIG_ROOT, { recursive: true });
  const p = configPath(projectKey());
  fs.writeFileSync(p, JSON.stringify(merged, null, 2), "utf8");
  return p;
}
