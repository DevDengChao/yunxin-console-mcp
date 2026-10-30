import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import type { SessionData } from "../src/auth/session.js";
import { AuthExpiredError, FrontApiClient, FrontApiError } from "../src/http/client.js";

const originalFetch = globalThis.fetch;
const tempDirs: string[] = [];

function makeClient(withCookie = true): FrontApiClient {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunxin-client-"));
  tempDirs.push(dir);
  const config = loadConfig({ YUNXIN_CONSOLE_HOME: dir } as NodeJS.ProcessEnv);
  const session: SessionData | null = withCookie
    ? {
        version: 1,
        savedAt: new Date().toISOString(),
        cookies: [
          {
            name: "DEMO_SESS",
            value: "secret",
            domain: ".yunxin.163.com",
            path: "/",
            expires: "Infinity",
          },
        ],
      }
    : null;
  return new FrontApiClient(config, session);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json;charset=UTF-8" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("FrontApiClient", () => {
  it("unwraps msg and sends cookies and query params", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ res: 200, requestId: "r1", msg: { appname: "DemoApp" } }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = makeClient();
    const result = await client.get<{ appname: string }>("/frontApi/app/queryAppInfo", {
      aid: 10000001,
    });

    expect(result.appname).toBe("DemoApp");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain("/frontApi/app/queryAppInfo?aid=10000001");
    expect((init.headers as Record<string, string>).cookie).toContain("DEMO_SESS=secret");
    expect((init.headers as Record<string, string>)["x-requested-with"]).toBe("XMLHttpRequest");
  });

  it("returns the full envelope in raw mode", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ res: 200, requestId: "r2", msg: [] }),
    ) as unknown as typeof fetch;
    const client = makeClient();
    const result = await client.request<{ res: number; requestId?: string }>({
      path: "/frontApi/app/myAppList",
      method: "POST",
      raw: true,
    });
    expect(result.res).toBe(200);
    expect(result.requestId).toBe("r2");
  });

  it("sends JSON bodies for POST", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ res: 200, msg: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = makeClient();
    await client.post("/frontApi/app/addApp", undefined, { appname: "x" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ appname: "x" }));
  });

  it("maps non-200 res to FrontApiError", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ res: 400, errmsg: "参数错误", requestId: "r3" }),
    ) as unknown as typeof fetch;
    const client = makeClient();
    await expect(client.get("/frontApi/app/queryAppInfo")).rejects.toMatchObject({
      name: "FrontApiError",
      code: 400,
      requestId: "r3",
    });
  });

  it("detects an expired login", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ res: 401, errmsg: "未登录" }),
    ) as unknown as typeof fetch;
    const client = makeClient();
    await expect(client.get("/frontApi/app/queryAppInfo")).rejects.toBeInstanceOf(
      AuthExpiredError,
    );
  });

  it("detects an HTML login page", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("<html><body>login</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;
    const client = makeClient();
    await expect(client.get("/frontApi/app/queryAppInfo")).rejects.toBeInstanceOf(
      AuthExpiredError,
    );
  });

  it("fails fast without a session", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = makeClient(false);
    await expect(client.get("/frontApi/app/queryAppInfo")).rejects.toBeInstanceOf(
      AuthExpiredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes FrontApiError for typed errors", () => {
    const error = new FrontApiError("boom", { code: 500, path: "/x" });
    expect(error.code).toBe(500);
    expect(error.message).toBe("boom");
  });

  it("writes a redacted audit entry for writes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunxin-audit-"));
    tempDirs.push(dir);
    const config = loadConfig({ YUNXIN_CONSOLE_HOME: dir } as NodeJS.ProcessEnv);
    const session: SessionData = {
      version: 1,
      savedAt: new Date().toISOString(),
      cookies: [
        {
          name: "DEMO_SESS",
          value: "secret",
          domain: ".yunxin.163.com",
          path: "/",
          expires: "Infinity",
        },
      ],
    };
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ res: 200, msg: { ok: true } }),
    ) as unknown as typeof fetch;

    const client = new FrontApiClient(config, session);
    await client.post(
      "/frontApi/app/updateInfo",
      { aid: 1, appSecret: "topsecret" },
      { appname: "x" },
    );

    const entries = fs
      .readFileSync(config.auditLogFile, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(entries).toHaveLength(1);
    expect(entries[0].method).toBe("POST");
    expect(entries[0].query.appSecret).toBe("***");
    expect(JSON.stringify(entries[0])).not.toContain("topsecret");
  });
});
