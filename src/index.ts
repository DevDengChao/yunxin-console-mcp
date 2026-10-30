#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { SERVER_NAME, VERSION } from "./version.js";

async function main(): Promise<void> {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] v${VERSION} running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] fatal:`, error);
  process.exit(1);
});
