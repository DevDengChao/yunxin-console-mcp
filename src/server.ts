import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, type AppConfig } from "./config.js";
import { SessionStore } from "./auth/store.js";
import { FrontApiClient } from "./http/client.js";
import { registerAuthTools, type ToolContext } from "./tools/auth.js";
import { registerAppTools } from "./tools/apps.js";
import { registerAppSettingTools } from "./tools/app-settings.js";
import { registerImTools } from "./tools/im.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerGenericTools } from "./tools/generic.js";
import { SERVER_NAME, VERSION } from "./version.js";

export interface ServerBundle {
  server: McpServer;
  context: ToolContext;
}

export function registerAllTools(server: McpServer, context: ToolContext): void {
  registerAuthTools(server, context);
  registerAppTools(server, context);
  registerAppSettingTools(server, context);
  registerImTools(server, context);
  registerStatsTools(server, context);
  registerGenericTools(server, context);
}

export function createServer(config: AppConfig = loadConfig()): ServerBundle {
  const store = new SessionStore(config);
  store.get();
  if (store.error()) {
    console.error(`[${SERVER_NAME}] failed to load session:`, store.error());
  }

  const context: ToolContext = {
    config,
    get session() {
      return store.get();
    },
    get sessionError() {
      return store.error();
    },
    client: new FrontApiClient(config, () => store.get()),
  };

  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  registerAllTools(server, context);

  return { server, context };
}
