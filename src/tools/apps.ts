import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAppConfig, getAppInfo, getImConfig, listApps, resolveApp } from "../api/apps.js";
import type { ToolContext } from "./auth.js";
import { errorResult, jsonResult } from "./helpers.js";

export function registerAppTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "yunxin_apps_list",
    {
      title: "List Yunxin applications",
      description:
        "列出当前账号下的云信应用，返回应用名称、appid、已开通产品、套餐和创建时间。支持按名称关键字搜索和分页。",
      inputSchema: {
        keyword: z.string().optional().describe("应用名称关键字，留空列出全部"),
        limit: z.number().int().min(1).max(100).optional().describe("每页数量，默认 20"),
        offset: z.number().int().min(0).optional().describe("偏移量，默认 0"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ keyword, limit, offset }) => {
      try {
        const result = await listApps(context.client, { keyword, limit, offset });
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_get",
    {
      title: "Get Yunxin application details",
      description:
        "查询单个应用的基本信息、产品配置，可选返回 IM 配置。app 参数支持应用名称（如 DemoApp）或 appid。",
      inputSchema: {
        app: z
          .union([z.string(), z.number()])
          .optional()
          .describe("应用名称或 appid；不传则使用 YUNXIN_CONSOLE_DEFAULT_APP"),
        includeConfig: z.boolean().optional().describe("是否包含产品配置，默认 true"),
        includeImConfig: z.boolean().optional().describe("是否包含 IM 配置，默认 false"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ app, includeConfig, includeImConfig }) => {
      try {
        const resolved = await resolveApp(context.client, {
          app,
          defaultApp: context.config.defaultApp,
        });
        const [info, config, imConfig] = await Promise.all([
          getAppInfo(context.client, resolved.appid),
          includeConfig === false ? Promise.resolve(undefined) : getAppConfig(context.client, resolved.appid),
          includeImConfig ? getImConfig(context.client, resolved.appid) : Promise.resolve(undefined),
        ]);
        return jsonResult({
          app: resolved,
          info,
          ...(config ? { config } : {}),
          ...(imConfig ? { imConfig } : {}),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
