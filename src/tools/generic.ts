import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QueryValue } from "../http/client.js";
import type { ToolContext } from "./auth.js";
import { errorResult, jsonResult } from "./helpers.js";
import { assertWriteAllowed, isLikelyReadOnlyPath } from "./write-guard.js";

const queryValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export function registerGenericTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "yunxin_api_call",
    {
      title: "Call any Yunxin console frontApi endpoint",
      description:
        "直接调用云信控制台内部 /frontApi 接口，用于覆盖尚未封装成专用工具的能力。path 例如 /frontApi/app/queryAppInfo；query 会拼到 URL；body 会以 JSON 发送。写操作（非查询类 POST/PUT/DELETE）必须传 confirm: true。",
      inputSchema: {
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional().describe("HTTP 方法，默认 GET"),
        path: z.string().describe("以 /frontApi 开头，或省略前缀直接写 /app/..."),
        query: z.record(z.string(), queryValueSchema).optional().describe("URL 查询参数"),
        body: z.any().optional().describe("JSON 请求体"),
        confirm: z.boolean().optional().describe("写操作确认；查询类请求不需要"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ method, path, query, body, confirm }) => {
      const httpMethod = method ?? "GET";
      try {
        const isReadOnly = httpMethod === "GET" || (httpMethod === "POST" && isLikelyReadOnlyPath(path));
        if (!isReadOnly) {
          assertWriteAllowed(context.config, confirm, `${httpMethod} ${path}`);
        }
        const response = await context.client.request<unknown>({
          method: httpMethod,
          path,
          query: query as Record<string, QueryValue> | undefined,
          body,
          raw: true,
        });
        return jsonResult({ request: { method: httpMethod, path }, response });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
