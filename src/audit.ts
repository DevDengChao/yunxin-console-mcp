import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config.js";

export interface AuditEntry {
  at: string;
  event: "ok" | "error";
  method: string;
  path: string;
  query?: Record<string, unknown>;
  error?: string;
}

const SECRET_KEY = /secret|password|passwd|cookie|token|authorization|session/i;

export function redactQuery(
  query?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!query) return undefined;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    redacted[key] = SECRET_KEY.test(key) ? "***" : value;
  }
  return redacted;
}

/** Writes one JSON line to the local audit log. Never throws. */
export function appendAudit(config: AppConfig, entry: AuditEntry): void {
  try {
    fs.mkdirSync(path.dirname(config.auditLogFile), { recursive: true });
    fs.appendFileSync(config.auditLogFile, `${JSON.stringify(entry)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Auditing must never break an API call.
  }
}
