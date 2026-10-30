import fs from "node:fs";
import type { AppConfig } from "../config.js";
import { loadSession, type SessionData } from "./session.js";

/**
 * Caches the session file and reloads it when its mtime or size changes.
 * This lets a running MCP server pick up `auth import` / `login` immediately,
 * without restarting the client.
 */
export class SessionStore {
  private cached: SessionData | null = null;
  private mtimeMs = -1;
  private size = -1;
  private loaded = false;
  private lastError: string | null = null;

  constructor(private readonly config: AppConfig) {}

  get(): SessionData | null {
    try {
      const stat = fs.statSync(this.config.sessionFile);
      if (
        !this.loaded ||
        stat.mtimeMs !== this.mtimeMs ||
        stat.size !== this.size
      ) {
        this.cached = loadSession(this.config);
        this.mtimeMs = stat.mtimeMs;
        this.size = stat.size;
        this.loaded = true;
        this.lastError = null;
      }
      return this.cached;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.cached = null;
        this.mtimeMs = -1;
        this.size = -1;
        this.loaded = true;
        this.lastError = null;
        return null;
      }
      this.lastError = error instanceof Error ? error.message : String(error);
      // Keep the last known-good session so a transient read error does not
      // immediately break every in-flight tool call.
      return this.cached;
    }
  }

  error(): string | null {
    return this.lastError;
  }
}
