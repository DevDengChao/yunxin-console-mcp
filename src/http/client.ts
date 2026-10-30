import { API_BASE_PATH, API_ORIGIN, type AppConfig } from "../config.js";
import { appendAudit, redactQuery } from "../audit.js";
import { getCookieHeader, type SessionData } from "../auth/session.js";

export class FrontApiError extends Error {
  readonly code: number;
  readonly requestId?: string;
  readonly path: string;
  readonly httpStatus?: number;

  constructor(
    message: string,
    options: { code: number; path: string; requestId?: string; httpStatus?: number },
  ) {
    super(message);
    this.name = "FrontApiError";
    this.code = options.code;
    this.requestId = options.requestId;
    this.path = options.path;
    this.httpStatus = options.httpStatus;
  }
}

export class AuthExpiredError extends FrontApiError {
  constructor(message: string, options: { path: string; code?: number; requestId?: string }) {
    super(message, {
      code: options.code ?? 401,
      path: options.path,
      requestId: options.requestId,
    });
    this.name = "AuthExpiredError";
  }
}

export interface FrontApiEnvelope<T> {
  res: number;
  requestId?: string;
  msg?: T;
  errmsg?: string;
}

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Return the full `{ res, msg, requestId }` envelope instead of `msg`. */
  raw?: boolean;
}

const AUTH_ERROR_PATTERN = /登录|未登录|会话|session|auth|token.*(失效|过期)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
  if (/^https?:\/\//i.test(path)) {
    throw new Error("Absolute URLs are not allowed");
  }
  const normalized = path.startsWith(API_BASE_PATH)
    ? path
    : `${API_BASE_PATH}${path.startsWith("/") ? "" : "/"}${path}`;
  const url = new URL(normalized, API_ORIGIN);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url;
}

export class FrontApiClient {
  private lastSession: SessionData | null | undefined = undefined;
  private lastOverride: string | undefined = undefined;
  private headerCache = "";

  constructor(
    private readonly config: AppConfig,
    private readonly sessionSource: SessionData | null | (() => SessionData | null),
  ) {}

  /** Re-resolves the session so a long-running server sees auth import/login. */
  private currentCookieHeader(): string {
    const session =
      typeof this.sessionSource === "function" ? this.sessionSource() : this.sessionSource;
    if (session !== this.lastSession || this.config.cookieOverride !== this.lastOverride) {
      this.headerCache = getCookieHeader(this.config, session);
      this.lastSession = session;
      this.lastOverride = this.config.cookieOverride;
    }
    return this.headerCache;
  }

  hasSession(): boolean {
    return this.currentCookieHeader().length > 0;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    const url = buildUrl(options.path, options.query);
    const path = url.pathname;
    const cookieHeader = this.currentCookieHeader();

    if (!cookieHeader) {
      throw new AuthExpiredError(
        "未找到云信控制台登录态。请先运行 `yunxin-console-mcp login` 完成登录，或设置 YUNXIN_CONSOLE_COOKIE。",
        { path },
      );
    }

    const audit =
      method !== "GET"
        ? {
            at: new Date().toISOString(),
            method,
            path,
            query: redactQuery(options.query),
          }
        : null;

    try {
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "zh-CN",
        "international-sites": "false",
        "x-requested-with": "XMLHttpRequest",
        origin: API_ORIGIN,
        referer: `${API_ORIGIN}/global/home`,
        "user-agent": this.config.userAgent,
        cookie: cookieHeader,
      };

      const init: RequestInit = { method, headers };
      if (options.body !== undefined) {
        headers["content-type"] = "application/json";
        init.body = JSON.stringify(options.body);
      }

      const attempts = method === "GET" ? 3 : 1;
      let lastError: unknown;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const response = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(this.config.timeoutMs),
          });
          const text = await response.text();
          const parsed = this.parseResponse<T>(text, response, path, options.raw ?? false);
          if (audit) {
            appendAudit(this.config, { ...audit, event: "ok" });
          }
          return parsed;
        } catch (error) {
          if (error instanceof FrontApiError) throw error;
          lastError = error;
          const isLast = attempt === attempts;
          if (isLast) break;
          await sleep(250 * attempt);
        }
      }

      const reason = lastError instanceof Error ? lastError.message : String(lastError);
      throw new FrontApiError(`调用 ${path} 失败：${reason}`, { code: 0, path });
    } catch (error) {
      if (audit) {
        appendAudit(this.config, {
          ...audit,
          event: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  private parseResponse<T>(
    text: string,
    response: Response,
    path: string,
    raw: boolean,
  ): T {
    const contentType = response.headers.get("content-type") ?? "";
    const trimmed = text.trimStart();
    if (
      contentType.includes("text/html") ||
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html")
    ) {
      throw new AuthExpiredError("登录态已失效（返回了登录页），请重新运行 `yunxin-console-mcp login`。", {
        path,
      });
    }

    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      if (!response.ok) {
        throw new FrontApiError(`HTTP ${response.status}：${text.slice(0, 300)}`, {
          code: response.status,
          path,
          httpStatus: response.status,
        });
      }
      // Some endpoints return plain text.
      return text as T;
    }

    if (!isRecord(payload)) {
      return payload as T;
    }

    const code = typeof payload.res === "number" ? payload.res : response.status;
    const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
    const errmsg = typeof payload.errmsg === "string" ? payload.errmsg : undefined;

    if (code !== 200) {
      if ([401, 403].includes(code) || (errmsg && AUTH_ERROR_PATTERN.test(errmsg))) {
        throw new AuthExpiredError(
          `登录态无效：${errmsg ?? `res=${code}`}。请重新运行 \`yunxin-console-mcp login\`。`,
          { path, code, requestId },
        );
      }
      throw new FrontApiError(errmsg || `接口返回 res=${code}`, { code, path, requestId });
    }

    if (!response.ok && !("res" in payload)) {
      throw new FrontApiError(`HTTP ${response.status}`, {
        code: response.status,
        path,
        httpStatus: response.status,
      });
    }

    if (raw) return payload as T;
    return (payload.msg ?? payload) as T;
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>({ method: "GET", path, query });
  }

  post<T>(path: string, query?: Record<string, QueryValue>, body?: unknown): Promise<T> {
    return this.request<T>({ method: "POST", path, query, body });
  }

  put<T>(path: string, query?: Record<string, QueryValue>, body?: unknown): Promise<T> {
    return this.request<T>({ method: "PUT", path, query, body });
  }

  delete<T>(path: string, query?: Record<string, QueryValue>, body?: unknown): Promise<T> {
    return this.request<T>({ method: "DELETE", path, query, body });
  }

  async getUserInfo(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>("/frontApi/ent/getUserInfo");
  }
}
