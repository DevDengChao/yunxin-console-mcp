import { describe, expect, it, vi } from "vitest";
import { AppResolutionError, listAllApps, resolveApp } from "../src/api/apps.js";
import type { FrontApiClient } from "../src/http/client.js";

const apps = [
  { appid: 10000001, appname: "DemoApp", imPkg: "PRO_2024" },
  { appid: 10000002, appname: "DemoApp-Test", imPkg: "FREE_2024" },
  { appid: 10000003, appname: "DemoApp-Prod", imPkg: "TRY" },
];

function fakeClient(list = apps): FrontApiClient {
  return {
    post: vi.fn(async () => ({ total: list.length, list })),
    get: vi.fn(),
  } as unknown as FrontApiClient;
}

describe("app resolution", () => {
  it("lists all apps", async () => {
    const client = fakeClient();
    const result = await listAllApps(client);
    expect(result).toHaveLength(3);
  });

  it("resolves by exact name", async () => {
    const client = fakeClient();
    const app = await resolveApp(client, { app: "DemoApp" });
    expect(app.appid).toBe(10000001);
  });

  it("resolves by numeric appid", async () => {
    const client = fakeClient();
    const app = await resolveApp(client, { app: 10000002 });
    expect(app.appname).toBe("DemoApp-Test");
  });

  it("resolves case-insensitively", async () => {
    const client = fakeClient();
    const app = await resolveApp(client, { app: "DEMOAPP" });
    expect(app.appid).toBe(10000001);
  });

  it("uses the default app", async () => {
    const client = fakeClient();
    const app = await resolveApp(client, { defaultApp: "DemoApp-Prod" });
    expect(app.appid).toBe(10000003);
  });

  it("reports candidates when ambiguous", async () => {
    const client = fakeClient([
      ...apps,
      { appid: 1, appname: "DemoApp-Test-2", imPkg: "FREE_2024" },
    ]);
    await expect(resolveApp(client, { app: "DemoApp-" })).rejects.toBeInstanceOf(
      AppResolutionError,
    );
  });

  it("reports available apps when missing", async () => {
    const client = fakeClient();
    await expect(resolveApp(client, { app: "nope" })).rejects.toThrow(/DemoApp/);
  });

  it("requires an app when no default is set", async () => {
    const client = fakeClient();
    await expect(resolveApp(client, {})).rejects.toThrow(/YUNXIN_CONSOLE_DEFAULT_APP/);
  });
});
