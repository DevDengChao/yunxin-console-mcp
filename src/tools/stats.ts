import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAppFuncStats,
  getImStats,
  getUserCityStats,
  getUserCountStats,
  getUserDayDetail,
  getUserProvinceStats,
  getUserRealTime,
  getYiDunStatusStats,
} from "../api/stats.js";
import type { ToolContext } from "./auth.js";
import { resolveAppForTool } from "./app-helpers.js";
import { errorResult, jsonResult } from "./helpers.js";

const appSchema = z.union([z.string(), z.number()]).optional();
const dateSchema = z.union([z.string(), z.number()]).optional();

export function registerStatsTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "yunxin_stats_users",
    {
      title: "Query IM user statistics",
      description:
        "用户统计：day 昨日概览、count 按日/小时趋势、province 省份分布、city 城市分布、realtime 实时在线。日期支持 YYYY-MM-DD 或毫秒时间戳。",
      inputSchema: {
        action: z.enum(["day", "count", "province", "city", "realtime"]),
        app: appSchema,
        date: dateSchema.describe("action=day 的日期，默认昨天"),
        start: dateSchema.describe("趋势开始日期"),
        end: dateSchema.describe("趋势结束日期"),
        datacycle: z.enum(["BYDAY", "BYHOUR"]).optional(),
        type: z.number().int().optional().describe("统计类型，默认 1"),
        os: z.string().optional().describe("操作系统过滤，例如 Android/iOS/PC/Web"),
        province: z.string().optional().describe("action=city 的省份过滤"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ action, app, date, start, end, datacycle, type, os, province }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        switch (action) {
          case "day":
            return jsonResult(await getUserDayDetail(context.client, resolved.appid, date));
          case "count":
            return jsonResult(
              await getUserCountStats(context.client, resolved.appid, {
                start,
                end,
                datacycle,
                type,
                os,
              }),
            );
          case "province":
            return jsonResult(
              await getUserProvinceStats(context.client, resolved.appid, { start, end }),
            );
          case "city":
            return jsonResult(
              await getUserCityStats(context.client, resolved.appid, { start, end, province }),
            );
          default:
            return jsonResult(await getUserRealTime(context.client, resolved.appid));
        }
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_stats_im",
    {
      title: "Query IM message statistics",
      description:
        "IM 统计：按 tab/childTab 查询消息数、群组、聊天室、IM 存储、第三方回调、消息抄送、推送、安全通、圈组等数据。常用 tab=MESSAGE_COUNT，childTab=SINGLE_MESSAGE_COUNT/GROUP_MESSAGE_COUNT/CHATROOM_MESSAGE_COUNT。",
      inputSchema: {
        app: appSchema,
        tab: z.string().describe("统计页签，例如 MESSAGE_COUNT"),
        childTab: z.string().optional().describe("子页签，例如 SINGLE_MESSAGE_COUNT"),
        start: dateSchema.describe("开始日期，默认最近 7 天"),
        end: dateSchema.describe("结束日期，默认今天"),
        productNumber: z.string().optional(),
        yiDunBusinessId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ app, tab, childTab, start, end, productNumber, yiDunBusinessId }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        return jsonResult(
          await getImStats(context.client, resolved.appid, {
            tab,
            childTab,
            start,
            end,
            productNumber,
            yiDunBusinessId,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_stats_app",
    {
      title: "Query app function usage statistics",
      description: "查询应用功能使用情况，以及 IM 安全通检测状态统计。",
      inputSchema: {
        app: appSchema,
        includeYidun: z.boolean().optional().describe("是否同时查询安全通状态，默认 true"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ app, includeYidun }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        const [functions, yidun] = await Promise.all([
          getAppFuncStats(context.client, resolved.appid),
          includeYidun === false
            ? Promise.resolve(undefined)
            : getYiDunStatusStats(context.client, resolved.appid, "IM"),
        ]);
        return jsonResult({ app: resolved, functions, ...(yidun ? { yidun } : {}) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
