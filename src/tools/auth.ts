import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../config.js";
import { getCookieStats, type SessionData } from "../auth/session.js";
import type { FrontApiClient } from "../http/client.js";
import { AuthExpiredError } from "../http/client.js";
import { jsonResult, errorResult } from "./helpers.js";

export interface ToolContext {
  config: AppConfig;
  readonly session: SessionData | null;
  readonly sessionError: string | null;
  client: FrontApiClient;
}

export function registerAuthTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "yunxin_auth_status",
    {
      title: "Yunxin console login status",
      description:
        "检查云信控制台登录态，返回当前账号、企业信息、默认应用和写操作开关。登录态失效时会给出重新登录提示。",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const stats = getCookieStats(context.config, context.session);
      const sessionInfo = {
        sessionSavedAt: context.session?.savedAt ?? null,
        sessionSource: context.config.cookieOverride ? "env" : "file",
        sessionFile: context.config.sessionFile,
        cookieCount: stats.usedNames.length,
        cookieNames: stats.usedNames,
        droppedCookies: stats.dropped.map((item) => item.name),
        sessionError: context.sessionError,
      };
      try {
        const user = await context.client.getUserInfo();
        return jsonResult({
          authenticated: true,
          user,
          defaultApp: context.config.defaultApp ?? null,
          allowWrite: context.config.allowWrite,
          ...sessionInfo,
        });
      } catch (error) {
        if (error instanceof AuthExpiredError) {
          return jsonResult({
            authenticated: false,
            message: error.message,
            defaultApp: context.config.defaultApp ?? null,
            allowWrite: context.config.allowWrite,
            ...sessionInfo,
          });
        }
        return errorResult(error);
      }
    },
  );
}
