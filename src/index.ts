#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SERVER_NAME, VERSION } from "./version.js";

const server = new McpServer({
  name: SERVER_NAME,
  version: VERSION,
});

server.registerTool(
  "yunxin_ping",
  {
    title: "Ping the Yunxin console MCP server",
    description: "Health check. Returns pong and the server version.",
    inputSchema: {
      message: z.string().optional().describe("Optional message to echo back"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ message }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({ pong: true, message: message ?? null, version: VERSION }),
      },
    ],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] v${VERSION} running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] fatal:`, error);
  process.exit(1);
});
