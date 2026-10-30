import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import {
  createCookieJar,
  getCookieHeader,
  loadSession,
  saveSession,
  sessionFromStorageState,
  type SessionData,
} from "../src/auth/session.js";

const tempDirs: string[] = [];

function tempConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunxin-mcp-"));
  tempDirs.push(dir);
  return loadConfig({ YUNXIN_CONSOLE_HOME: dir } as NodeJS.ProcessEnv);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("session storage", () => {
  it("round-trips session cookies and builds a cookie header", () => {
    const config = tempConfig();
    const session: SessionData = {
      version: 1,
      savedAt: new Date().toISOString(),
      user: { loginAccount: "13800000000" },
      cookies: [
        {
          name: "DEMO_SESS",
          value: "abc123",
          domain: ".yunxin.163.com",
          path: "/",
          expires: "Infinity",
          httpOnly: true,
        },
      ],
    };
    saveSession(config, session);
    const loaded = loadSession(config);
    expect(loaded?.user?.loginAccount).toBe("13800000000");
    expect(getCookieHeader(config, loaded)).toContain("DEMO_SESS=abc123");
  });

  it("parses YUNXIN_CONSOLE_COOKIE override", () => {
    const config = loadConfig({
      YUNXIN_CONSOLE_HOME: tempConfig().homeDir,
      YUNXIN_CONSOLE_COOKIE: "a=1; b=2",
    } as NodeJS.ProcessEnv);
    expect(getCookieHeader(config, null)).toBe("a=1; b=2");
    const jar = createCookieJar(config, null);
    expect(jar.getCookieStringSync("https://app.yunxin.163.com/")).toContain("a=1");
  });

  it("converts Playwright storage state", () => {
    const session = sessionFromStorageState({
      cookies: [
        {
          name: "DEMO_SESS",
          value: "abc",
          domain: ".yunxin.163.com",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ],
    });
    expect(session.cookies).toHaveLength(1);
    expect(session.cookies[0].name).toBe("DEMO_SESS");
  });
});
