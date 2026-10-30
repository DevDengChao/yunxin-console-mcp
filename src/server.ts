import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, type AppConfig } from "./config.js";
import { loadSession, type SessionData } from "./auth/session.js";
import { FrontApiClient } from "./http/client.js";
import { registerAuthTools, type ToolContext } from "./tools/auth.js";
import { registerAppTools } from "./tools/apps.js";
import { registerGenericTools } from "./tools/generic.js";
import { SERVER_NAME, VERSION } from "./version.js";

export interface ServerBundle {
  server: McpServer;
  context: ToolContext;
}

export function createServer(config: AppConfig = loadConfig()): ServerBundle {
  let session: SessionData | null = null;
  try {
    session = loadSession(config);
  } catch (error) {
    console.error(`[${SERVER_NAME}] failed to load session:`, error);
  }

  const context: ToolContext = {
    config,
    session,
    client: new FrontApiClient(config, session),
  };

  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  registerAuthTools(server, context);
  registerAppTools(server, context);
  registerGenericTools(server, context);

  return { server, context };
}
