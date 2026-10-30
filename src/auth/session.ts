import fs from "node:fs";
import path from "node:path";
import { Cookie, CookieJar } from "tough-cookie";
import { API_ORIGIN, type AppConfig } from "../config.js";

export interface StoredCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number | string | null;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | string;
}

export interface SessionUser {
  cid?: number;
  loginAccount?: string;
  phone?: string;
  email?: string;
  corpName?: string;
  isMainAccount?: boolean;
  consoleVersion?: string;
  [key: string]: unknown;
}

export interface SessionData {
  version: 1;
  savedAt: string;
  user?: SessionUser;
  cookies: StoredCookie[];
}

export interface PlaywrightStorageState {
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }>;
  origins?: unknown[];
}

export interface CookieIssue {
  name?: string;
  reason: string;
}

export interface CookieParseResult {
  cookies: StoredCookie[];
  /** Number of `name=value` pairs seen, excluding Set-Cookie attributes. */
  total: number;
  duplicates: string[];
  issues: CookieIssue[];
}

export interface CookieDrop {
  name: string;
  reason: string;
}

export interface CookieStats {
  header: string;
  usedNames: string[];
  dropped: CookieDrop[];
}

const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const COOKIE_ATTRIBUTES = new Set([
  "path",
  "domain",
  "expires",
  "max-age",
  "samesite",
  "secure",
  "httponly",
  "priority",
  "partitioned",
]);

export function loadSession(config: AppConfig): SessionData | null {
  if (!fs.existsSync(config.sessionFile)) return null;
  const raw = fs.readFileSync(config.sessionFile, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `会话文件不是有效的 JSON：${config.sessionFile}（${reason}）。` +
        "请运行 `yunxin-console-mcp auth logout` 后重新登录或导入 Cookie。",
    );
  }
  if (!isSessionData(parsed)) {
    throw new Error(
      `会话文件格式不受支持：${config.sessionFile}。` +
        "请运行 `yunxin-console-mcp auth logout` 后重新登录或导入 Cookie。",
    );
  }
  return parsed;
}

function isSessionData(value: unknown): value is SessionData {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    Array.isArray(record.cookies) &&
    record.cookies.every(isStoredCookie)
  );
}

function isStoredCookie(value: unknown): value is StoredCookie {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && typeof record.value === "string";
}

export function saveSession(config: AppConfig, session: SessionData): void {
  writePrivateFile(config.sessionFile, `${JSON.stringify(session, null, 2)}\n`);
}

/**
 * Writes a secret file through a temporary file and renames it into place.
 * The rename is atomic on POSIX; on Windows it at least avoids partial writes.
 * On POSIX the file and its directory are tightened to 0600/0700.
 */
export function writePrivateFile(file: string, data: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(dir, 0o700);
    } catch {
      // Best effort: some filesystems do not support chmod.
    }
  }

  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    fs.writeFileSync(temp, data, { encoding: "utf8", mode: 0o600 });
    if (process.platform !== "win32") {
      try {
        fs.chmodSync(temp, 0o600);
      } catch {
        // Ignore chmod failures.
      }
    }
    renameWithRetry(temp, file);
  } catch (error) {
    try {
      fs.unlinkSync(temp);
    } catch {
      // Ignore cleanup failures.
    }
    throw error;
  }

  if (process.platform !== "win32") {
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // Existing file permissions could not be tightened.
    }
  }
}

function renameWithRetry(from: string, to: string): void {
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const retryable = code === "EPERM" || code === "EBUSY" || code === "EACCES";
      if (process.platform !== "win32" || !retryable || attempt >= 2) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

export function sessionFromCookieHeader(header: string, user?: SessionUser): SessionData {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    user,
    cookies: parseCookieHeader(header),
  };
}

export function sessionFromStorageState(
  state: PlaywrightStorageState,
  user?: SessionUser,
): SessionData {
  const cookies: StoredCookie[] = (state.cookies ?? []).map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || "/",
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  }));
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    user,
    cookies,
  };
}

export function parseCookieHeader(header: string): StoredCookie[] {
  return parseCookieHeaderDetailed(header).cookies;
}

/**
 * Parses a Cookie request header, a `Cookie:`-prefixed header, multiple
 * `Cookie:` lines, or a Set-Cookie-style string. Values keep their original
 * quotes; semicolons inside double quotes are not treated as separators.
 */
export function parseCookieHeaderDetailed(header: string): CookieParseResult {
  const normalized = normalizeCookieHeader(header);
  const result: CookieParseResult = {
    cookies: [],
    total: 0,
    duplicates: [],
    issues: [],
  };
  if (!normalized) return result;

  const byName = new Map<string, StoredCookie>();
  for (const part of splitCookiePairs(normalized)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    const bareName = (index > 0 ? trimmed.slice(0, index) : trimmed).trim().toLowerCase();
    if (COOKIE_ATTRIBUTES.has(bareName)) {
      // Attribute copied from a Set-Cookie header; not a cookie itself.
      continue;
    }
    if (index <= 0) {
      result.issues.push({ reason: `忽略无法解析的片段：${preview(trimmed)}` });
      continue;
    }

    const name = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    result.total += 1;

    if (!COOKIE_NAME.test(name)) {
      result.issues.push({ name, reason: "Cookie 名称包含非法字符" });
      continue;
    }
    if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(value)) {
      result.issues.push({ name, reason: "Cookie 值包含控制字符" });
      continue;
    }

    if (byName.has(name)) result.duplicates.push(name);
    byName.set(name, {
      name,
      value,
      domain: new URL(API_ORIGIN).hostname,
      path: "/",
    });
  }

  result.cookies = [...byName.values()];
  return result;
}

function normalizeCookieHeader(header: string): string {
  let text = header.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  // A JSON/CLI string may arrive wrapped in quotes.
  if (
    text.length >= 2 &&
    text.startsWith('"') &&
    text.endsWith('"') &&
    text.slice(1, -1).includes("=")
  ) {
    text = text.slice(1, -1).replace(/\\"/g, '"');
  }

  let merged = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const prefix = /^cookie:\s*/i.exec(trimmed);
    if (prefix) {
      if (merged) merged += "; ";
      merged += trimmed.slice(prefix[0].length);
    } else if (merged) {
      merged += ` ${trimmed}`;
    } else {
      merged = trimmed;
    }
  }
  return merged.trim();
}

function splitCookiePairs(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && quoted) {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      current += ch;
      continue;
    }
    if (ch === ";" && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function preview(value: string): string {
  const compact = value.replace(/\s+/g, " ");
  return compact.length > 40 ? `${compact.slice(0, 40)}…` : compact;
}

function cookieExpires(cookie: StoredCookie): Date | "Infinity" {
  if (cookie.expires === undefined || cookie.expires === null || cookie.expires === "") {
    return "Infinity";
  }
  if (typeof cookie.expires === "number") {
    // Chrome uses -1 for session cookies; Playwright may use seconds or milliseconds.
    if (cookie.expires <= 0) return "Infinity";
    const seconds = cookie.expires > 10_000_000_000 ? cookie.expires / 1000 : cookie.expires;
    return new Date(seconds * 1000);
  }
  if (cookie.expires === "Infinity") return "Infinity";
  const date = new Date(cookie.expires);
  return Number.isNaN(date.getTime()) ? "Infinity" : date;
}

function toToughCookie(cookie: StoredCookie): Cookie {
  return new Cookie({
    key: cookie.name,
    value: cookie.value,
    // tough-cookie v6 does not match leading-dot domains against subdomains.
    domain: cookie.domain?.replace(/^\./, ""),
    path: cookie.path || "/",
    expires: cookieExpires(cookie),
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite as Cookie["sameSite"],
  });
}

function fillJar(cookies: StoredCookie[]): { jar: CookieJar; dropped: CookieDrop[] } {
  const jar = new CookieJar();
  const dropped: CookieDrop[] = [];
  for (const cookie of cookies) {
    if (!cookie.name) continue;
    try {
      jar.setCookieSync(toToughCookie(cookie), API_ORIGIN);
    } catch (error) {
      dropped.push({
        name: cookie.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { jar, dropped };
}

export function buildCookieHeader(cookies: StoredCookie[]): CookieStats {
  const { jar, dropped } = fillJar(cookies);
  const active = jar.getCookiesSync(API_ORIGIN);
  return {
    header: jar.getCookieStringSync(API_ORIGIN),
    usedNames: active.map((cookie) => cookie.key),
    dropped,
  };
}

export function createCookieJar(config: AppConfig, session: SessionData | null): CookieJar {
  const cookies = config.cookieOverride
    ? parseCookieHeader(config.cookieOverride)
    : (session?.cookies ?? []);
  return fillJar(cookies).jar;
}

export function getCookieStats(
  config: AppConfig,
  session: SessionData | null,
): CookieStats {
  const cookies = config.cookieOverride
    ? parseCookieHeader(config.cookieOverride)
    : (session?.cookies ?? []);
  return buildCookieHeader(cookies);
}

export function getCookieHeader(config: AppConfig, session: SessionData | null): string {
  return getCookieStats(config, session).header;
}

export function hasUsableSession(config: AppConfig, session: SessionData | null): boolean {
  return getCookieHeader(config, session).length > 0;
}
