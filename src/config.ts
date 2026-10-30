import os from "node:os";
import path from "node:path";

export const API_ORIGIN = "https://app.yunxin.163.com";
export const API_BASE_PATH = "/frontApi";

export interface AppConfig {
  homeDir: string;
  sessionFile: string;
  storageStateFile: string;
  chromeProfileDir: string;
  auditLogFile: string;
  cookieOverride?: string;
  defaultApp?: string;
  allowWrite: boolean;
  timeoutMs: number;
  userAgent: string;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

function defaultHomeDir(env: NodeJS.ProcessEnv): string {
  if (env.YUNXIN_CONSOLE_HOME?.trim()) {
    return path.resolve(env.YUNXIN_CONSOLE_HOME.trim());
  }
  if (process.platform === "win32") {
    const appData = env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "yunxin-console-mcp");
  }
  const xdg = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdg, "yunxin-console-mcp");
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const homeDir = defaultHomeDir(env);
  return {
    homeDir,
    sessionFile: path.join(homeDir, "session.json"),
    storageStateFile: path.join(homeDir, "storage-state.json"),
    chromeProfileDir: path.join(homeDir, "chrome-profile"),
    auditLogFile: path.join(homeDir, "audit.log"),
    cookieOverride: env.YUNXIN_CONSOLE_COOKIE?.trim() || undefined,
    defaultApp: env.YUNXIN_CONSOLE_DEFAULT_APP?.trim() || undefined,
    // Writes are enabled by default. Set YUNXIN_CONSOLE_ALLOW_WRITE=false for read-only.
    allowWrite: env.YUNXIN_CONSOLE_ALLOW_WRITE !== "false",
    timeoutMs: parsePositiveInt(env.YUNXIN_CONSOLE_TIMEOUT_MS, 15_000),
    userAgent: env.YUNXIN_CONSOLE_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
  };
}
