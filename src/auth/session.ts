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

export function loadSession(config: AppConfig): SessionData | null {
  if (!fs.existsSync(config.sessionFile)) return null;
  const raw = fs.readFileSync(config.sessionFile, "utf8");
  const parsed = JSON.parse(raw) as SessionData;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.cookies)) {
    throw new Error(`Unsupported session file: ${config.sessionFile}`);
  }
  return parsed;
}

export function saveSession(config: AppConfig, session: SessionData): void {
  fs.mkdirSync(path.dirname(config.sessionFile), { recursive: true });
  fs.writeFileSync(config.sessionFile, `${JSON.stringify(session, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
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

function cookieExpires(cookie: StoredCookie): Date | "Infinity" {
  if (cookie.expires === undefined || cookie.expires === null || cookie.expires === "") {
    return "Infinity";
  }
  if (typeof cookie.expires === "number") {
    // Playwright uses seconds; tolerate milliseconds too.
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

function parseCookieHeader(header: string): StoredCookie[] {
  const cookies: StoredCookie[] = [];
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    cookies.push({
      name: trimmed.slice(0, index).trim(),
      value: trimmed.slice(index + 1).trim(),
      domain: new URL(API_ORIGIN).hostname,
      path: "/",
    });
  }
  return cookies;
}

export function createCookieJar(config: AppConfig, session: SessionData | null): CookieJar {
  const jar = new CookieJar();
  const cookies = config.cookieOverride
    ? parseCookieHeader(config.cookieOverride)
    : (session?.cookies ?? []);

  for (const cookie of cookies) {
    if (!cookie.name) continue;
    try {
      jar.setCookieSync(toToughCookie(cookie), API_ORIGIN);
    } catch {
      // Ignore cookies that cannot be attached to the console origin.
    }
  }
  return jar;
}

export function getCookieHeader(config: AppConfig, session: SessionData | null): string {
  if (config.cookieOverride) return config.cookieOverride;
  return createCookieJar(config, session).getCookieStringSync(API_ORIGIN);
}

export function hasUsableSession(config: AppConfig, session: SessionData | null): boolean {
  if (config.cookieOverride) return true;
  return Boolean(session && session.cookies.length > 0 && getCookieHeader(config, session));
}
