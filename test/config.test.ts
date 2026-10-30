import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses YUNXIN_CONSOLE_HOME when provided", () => {
    const home = path.join(os.tmpdir(), "yx-config-test");
    const config = loadConfig({ YUNXIN_CONSOLE_HOME: home } as NodeJS.ProcessEnv);
    expect(config.homeDir).toBe(path.resolve(home));
    expect(config.sessionFile).toContain("session.json");
  });

  it("enables writes by default and disables with false", () => {
    expect(loadConfig({} as NodeJS.ProcessEnv).allowWrite).toBe(true);
    expect(
      loadConfig({ YUNXIN_CONSOLE_ALLOW_WRITE: "false" } as NodeJS.ProcessEnv).allowWrite,
    ).toBe(false);
  });

  it("parses timeout and default app", () => {
    const config = loadConfig({
      YUNXIN_CONSOLE_TIMEOUT_MS: "2500",
      YUNXIN_CONSOLE_DEFAULT_APP: "DemoApp",
    } as NodeJS.ProcessEnv);
    expect(config.timeoutMs).toBe(2500);
    expect(config.defaultApp).toBe("DemoApp");
  });
});
