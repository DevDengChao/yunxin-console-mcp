import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../src/config.js";
import type { FrontApiClient } from "../src/http/client.js";
import { registerAllTools } from "../src/server.js";
import type { ToolContext } from "../src/tools/auth.js";

const tempDirs: string[] = [];

function tempConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunxin-tools-"));
  tempDirs.push(dir);
  return loadConfig({ YUNXIN_CONSOLE_HOME: dir } as NodeJS.ProcessEnv);
}

function fakeClient(): FrontApiClient {
  return {
    hasSession: () => true,
    getUserInfo: vi.fn(async () => ({
      loginAccount: "13800000000",
      corpName: "测试企业",
    })),
    get: vi.fn(async (path: string) => {
      if (path.includes("/ent/getUserInfo")) {
        return { loginAccount: "13800000000", corpName: "测试企业" };
      }
      if (path.includes("/app/queryAppInfo")) {
        return { aid: 10000001, appname: "DemoApp", region: "海外" };
      }
      if (path.includes("/app/appConfig")) return { imCurrPkg: "PRO_2024" };
      if (path.includes("/app/key/query")) {
        return { appKey: "app-key", appSecret: "secret-123456" };
      }
      if (path.includes("/app/im/config/query")) {
        return { imMainSwitch: true, deletemsgtime: 120 };
      }
      return {};
    }),
    post: vi.fn(async (path: string) => {
      if (path.includes("/app/myAppList")) {
        return {
          total: 1,
          list: [{ appid: 10000001, appname: "DemoApp", imPkg: "PRO_2024" }],
        };
      }
      return { ok: true };
    }),
    put: vi.fn(async () => ({ ok: true })),
    delete: vi.fn(async () => ({ ok: true })),
    request: vi.fn(async (options: { path: string; raw?: boolean }) => ({
      res: 200,
      requestId: "req-1",
      msg: { ok: true },
      path: options.path,
    })),
  } as unknown as FrontApiClient;
}

async function setup(): Promise<{
  client: Client;
  fake: FrontApiClient;
  config: ReturnType<typeof loadConfig>;
  close: () => Promise<void>;
}> {
  const config = tempConfig();
  const fake = fakeClient();
  const context: ToolContext = { config, session: null, client: fake };
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerAllTools(server, context);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);

  return {
    client,
    fake,
    config,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string; data: unknown }> {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // plain-text error
  }
  return { isError: Boolean(result.isError), text, data };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("MCP tool handlers", () => {
  it("reports the current login status", async () => {
    const { client, close } = await setup();
    const result = await call(client, "yunxin_auth_status", {});
    expect(result.isError).toBe(false);
    expect((result.data as { authenticated: boolean }).authenticated).toBe(true);
    expect((result.data as { user: { loginAccount: string } }).user.loginAccount).toBe(
      "13800000000",
    );
    await close();
  });

  it("lists applications", async () => {
    const { client, close } = await setup();
    const result = await call(client, "yunxin_apps_list", {});
    expect(result.isError).toBe(false);
    expect((result.data as { total: number }).total).toBe(1);
    await close();
  });

  it("resolves an application by name and returns IM config", async () => {
    const { client, close } = await setup();
    const result = await call(client, "yunxin_app_get", {
      app: "DemoApp",
      includeImConfig: true,
    });
    expect(result.isError).toBe(false);
    const data = result.data as {
      app: { appid: number };
      info: { appname: string };
      imConfig: { imMainSwitch: boolean };
    };
    expect(data.app.appid).toBe(10000001);
    expect(data.info.appname).toBe("DemoApp");
    expect(data.imConfig.imMainSwitch).toBe(true);
    await close();
  });

  it("masks AppSecret unless explicitly requested", async () => {
    const { client, close } = await setup();
    const masked = await call(client, "yunxin_app_keys", { app: "DemoApp", action: "get" });
    expect((masked.data as { appSecret: string }).appSecret).not.toBe("secret-123456");

    const full = await call(client, "yunxin_app_keys", {
      app: "DemoApp",
      action: "get",
      includeSecret: true,
    });
    expect((full.data as { appSecret: string }).appSecret).toBe("secret-123456");
    await close();
  });

  it("updates an IM field through the mapped endpoint", async () => {
    const { client, fake, close } = await setup();
    const result = await call(client, "yunxin_im_config_update", {
      app: "DemoApp",
      deletemsgtime: 120,
      confirm: true,
    });
    expect(result.isError).toBe(false);
    expect((result.data as { ok: boolean }).ok).toBe(true);
    expect(fake.post).toHaveBeenCalledWith(
      "/frontApi/app/updateDeletemsgtime",
      { aid: 10000001, deletemsgtime: 120 },
    );
    await close();
  });

  it("requires confirmation for generic writes", async () => {
    const { client, close } = await setup();
    const result = await call(client, "yunxin_api_call", {
      method: "POST",
      path: "/frontApi/app/updateInfo",
      body: { appname: "x" },
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("confirm");
    await close();
  });

  it("allows generic read-only POST queries without confirmation", async () => {
    const { client, close } = await setup();
    const result = await call(client, "yunxin_api_call", {
      method: "POST",
      path: "/frontApi/app/queryAppInfo",
      query: { aid: 10000001 },
    });
    expect(result.isError).toBe(false);
    expect((result.data as { response: { res: number } }).response.res).toBe(200);
    await close();
  });
});
