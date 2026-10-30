import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunxin-mcp-it-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("MCP server", () => {
  it("starts over stdio and exposes the tool catalog", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve("dist/cli.js")],
      env: {
        ...process.env,
        YUNXIN_CONSOLE_HOME: tempDir(),
        YUNXIN_CONSOLE_COOKIE: "",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "vitest", version: "0.0.0" });
    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain("yunxin_auth_status");
    expect(names).toContain("yunxin_apps_list");
    expect(names).toContain("yunxin_app_get");
    expect(names).toContain("yunxin_im_config_update");
    expect(names).toContain("yunxin_stats_im");
    expect(names).toContain("yunxin_api_call");

    const status = await client.callTool({ name: "yunxin_auth_status", arguments: {} });
    const text = (status.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(text).authenticated).toBe(false);

    await client.close();
  }, 30_000);
});
