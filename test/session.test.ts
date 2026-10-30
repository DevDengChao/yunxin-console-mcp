import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import {
  createCookieJar,
  getCookieHeader,
  loadSession,
  parseCookieHeaderDetailed,
  saveSession,
  sessionFromCookieHeader,
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

  it("writes session files atomically and tightens permissions", () => {
    const config = tempConfig();
    const session = sessionFromCookieHeader("a=1; b=2");
    saveSession(config, session);
    expect(loadSession(config)?.cookies).toHaveLength(2);
    if (process.platform !== "win32") {
      expect(fs.statSync(config.sessionFile).mode & 0o777).toBe(0o600);
      expect(fs.statSync(config.homeDir).mode & 0o777).toBe(0o700);
    }
  });

  it("reports a corrupt session file with a recovery hint", () => {
    const config = tempConfig();
    fs.writeFileSync(config.sessionFile, "{not-json");
    expect(() => loadSession(config)).toThrow(/不是有效的 JSON/);
    expect(() => loadSession(config)).toThrow(/auth logout/);
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

  it("normalizes Cookie: prefixes and line breaks in the env override", () => {
    const config = loadConfig({
      YUNXIN_CONSOLE_HOME: tempConfig().homeDir,
      YUNXIN_CONSOLE_COOKIE:
        'Cookie: a=1\r\nCookie: channel="h=media&x=1"; urs_t=FAKE_T',
    } as NodeJS.ProcessEnv);
    const header = getCookieHeader(config, null);
    expect(header.startsWith("Cookie:")).toBe(false);
    expect(header).toContain('channel="h=media&x=1"');
    expect(header).toContain("urs_t=FAKE_T");
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

describe("cookie header parsing", () => {
  it("keeps cookies after a quoted value", () => {
    const parsed = parseCookieHeaderDetailed(
      'locale=zh_CN; channel="h=media&t=media"; clueFrom=nim; urs_t=FAKE_T; urs_u=FAKE_U',
    );
    expect(parsed.cookies.map((cookie) => cookie.name)).toEqual([
      "locale",
      "channel",
      "clueFrom",
      "urs_t",
      "urs_u",
    ]);
    expect(parsed.cookies[1].value).toBe('"h=media&t=media"');
    expect(parsed.total).toBe(5);
  });

  it("does not split semicolons inside double quotes", () => {
    const parsed = parseCookieHeaderDetailed('a="x;y"; b=2');
    expect(parsed.cookies.map((cookie) => cookie.name)).toEqual(["a", "b"]);
    expect(parsed.cookies[0].value).toBe('"x;y"');
  });

  it("merges multiple Cookie: lines", () => {
    const parsed = parseCookieHeaderDetailed("Cookie: a=1; b=2\r\nCookie: c=3");
    expect(parsed.cookies.map((cookie) => cookie.name)).toEqual(["a", "b", "c"]);
  });

  it("ignores Set-Cookie attributes", () => {
    const parsed = parseCookieHeaderDetailed(
      "a=1; Path=/; Domain=.yunxin.163.com; Expires=Wed, 21 Oct 2026 07:28:00 GMT; " +
        "Max-Age=3600; Secure; HttpOnly; SameSite=Lax",
    );
    expect(parsed.cookies.map((cookie) => cookie.name)).toEqual(["a"]);
    expect(parsed.total).toBe(1);
  });

  it("keeps the last duplicate and reports it", () => {
    const parsed = parseCookieHeaderDetailed("a=1; a=2");
    expect(parsed.cookies).toHaveLength(1);
    expect(parsed.cookies[0].value).toBe("2");
    expect(parsed.duplicates).toEqual(["a"]);
  });

  it("rejects invalid cookie names and control characters", () => {
    const parsed = parseCookieHeaderDetailed("bad name=1; good=2; evil=a\u0001b");
    expect(parsed.cookies.map((cookie) => cookie.name)).toEqual(["good"]);
    expect(parsed.issues).toHaveLength(2);
  });

  it("round-trips more than ten cookies", () => {
    const header = Array.from({ length: 50 }, (_, index) => {
      return `cookie_${index + 1}=value_${index + 1}`;
    }).join("; ");
    const session = sessionFromCookieHeader(header);
    expect(session.cookies).toHaveLength(50);
    expect(getCookieHeader(tempConfig(), session).split("; ")).toHaveLength(50);
  });
});
