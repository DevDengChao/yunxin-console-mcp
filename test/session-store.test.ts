import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { SessionStore } from "../src/auth/store.js";
import { saveSession, sessionFromCookieHeader } from "../src/auth/session.js";

const tempDirs: string[] = [];

function tempConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunxin-store-"));
  tempDirs.push(dir);
  return loadConfig({ YUNXIN_CONSOLE_HOME: dir } as NodeJS.ProcessEnv);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("SessionStore", () => {
  it("reloads a running session when the file changes", () => {
    const config = tempConfig();
    const store = new SessionStore(config);
    expect(store.get()).toBeNull();

    saveSession(config, sessionFromCookieHeader("a=1"));
    expect(store.get()?.cookies[0]?.value).toBe("1");

    saveSession(config, sessionFromCookieHeader("a=longer-value"));
    expect(store.get()?.cookies[0]?.value).toBe("longer-value");
  });

  it("returns null after the session file is deleted", () => {
    const config = tempConfig();
    const store = new SessionStore(config);
    saveSession(config, sessionFromCookieHeader("a=1"));
    expect(store.get()).not.toBeNull();

    fs.unlinkSync(config.sessionFile);
    expect(store.get()).toBeNull();
  });

  it("keeps the last good session and reports corruption", () => {
    const config = tempConfig();
    const store = new SessionStore(config);
    saveSession(config, sessionFromCookieHeader("a=1"));
    expect(store.get()?.cookies[0]?.value).toBe("1");

    fs.writeFileSync(config.sessionFile, "{not-json");
    expect(store.get()?.cookies[0]?.value).toBe("1");
    expect(store.error()).toMatch(/不是有效的 JSON/);

    saveSession(config, sessionFromCookieHeader("a=fixed"));
    expect(store.get()?.cookies[0]?.value).toBe("fixed");
    expect(store.error()).toBeNull();
  });
});
