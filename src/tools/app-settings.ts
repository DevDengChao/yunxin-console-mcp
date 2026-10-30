import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addCert,
  addCustomPush,
  createApp,
  deleteCert,
  deleteCustomPush,
  deleteIpWhitelist,
  deleteThirdPushConfig,
  editCert,
  editIpWhitelist,
  getAppKeys,
  getAppSetting,
  getCustomPushContent,
  getIdentity,
  getIpWhitelistStatus,
  getMsgCopyConfig,
  listCerts,
  listChangeRecords,
  listCustomPush,
  listFunctionMatrix,
  listIpWhitelist,
  queryThirdPushConfig,
  randomAppSecret,
  refreshAppSecret,
  saveThirdPushConfig,
  setCallback,
  setDefaultPushContent,
  setIpWhitelist,
  updateAppInfo,
  updateCheckAppBundle,
  updateCustomPush,
  updateIdentity,
} from "../api/app-settings.js";
import { getImConfig } from "../api/im.js";
import type { ToolContext } from "./auth.js";
import { resolveAppForTool, maskSecret } from "./app-helpers.js";
import { errorResult, jsonResult } from "./helpers.js";
import { assertWriteAllowed } from "./write-guard.js";

const appSchema = z.union([z.string(), z.number()]).optional();
const recordSchema = z.record(z.string(), z.any());

export function registerAppSettingTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "yunxin_app_keys",
    {
      title: "Manage Yunxin app keys",
      description:
        "查询 AppKey/AppSecret，或重置 AppSecret。action=get 查询；set_secret 设置指定密钥；random 随机生成新密钥。重置密钥会让使用旧密钥的客户端失效，必须传 confirm: true。",
      inputSchema: {
        action: z.enum(["get", "set_secret", "random"]).optional().describe("默认 get"),
        app: appSchema.describe("应用名称或 appid"),
        appSecret: z.string().optional().describe("action=set_secret 时的新 AppSecret"),
        includeSecret: z.boolean().optional().describe("get 时是否返回完整 AppSecret，默认打码"),
        confirm: z.boolean().optional().describe("重置密钥时必须为 true"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action = "get", app, appSecret, includeSecret, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "get") {
          const keys = await getAppKeys(context.client, resolved.appid);
          return jsonResult({
            ...keys,
            appSecret: includeSecret ? keys.appSecret : maskSecret(keys.appSecret),
          });
        }
        assertWriteAllowed(context.config, confirm, "重置 AppSecret");
        if (action === "set_secret") {
          if (!appSecret) throw new Error("action=set_secret 需要提供 appSecret");
          const result = await refreshAppSecret(context.client, resolved.appid, appSecret);
          return jsonResult({ ok: true, result });
        }
        const result = await randomAppSecret(context.client, resolved.appid);
        return jsonResult({ ok: true, result });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_admin",
    {
      title: "Yunxin app administration",
      description:
        "应用级管理：create 创建应用、update 修改应用名称/行业/简介、settings 查询应用设置、msg_copy 查询消息抄送、change_records 查询功能变更记录、function_matrix 查询功能矩阵。",
      inputSchema: {
        action: z.enum([
          "create",
          "update",
          "settings",
          "msg_copy",
          "change_records",
          "function_matrix",
        ]),
        app: appSchema,
        data: recordSchema.optional().describe("create/update 的字段，例如 {appname, category, appdesc}"),
        start: z.string().optional().describe("变更记录开始日期 YYYY-MM-DD"),
        end: z.string().optional().describe("变更记录结束日期 YYYY-MM-DD"),
        functions: z.array(z.string()).optional().describe("变更记录功能编码过滤"),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, data, start, end, functions, limit, offset, confirm }) => {
      try {
        if (action === "create") {
          assertWriteAllowed(context.config, confirm, "创建应用");
          if (!data) throw new Error("action=create 需要提供 data");
          return jsonResult(await createApp(context.client, data));
        }
        const resolved = await resolveAppForTool(context, app);
        switch (action) {
          case "update":
            assertWriteAllowed(context.config, confirm, "修改应用信息", {
              requireConfirm: false,
            });
            if (!data) throw new Error("action=update 需要提供 data");
            return jsonResult(await updateAppInfo(context.client, resolved.appid, data));
          case "settings":
            return jsonResult(await getAppSetting(context.client, resolved.appid));
          case "msg_copy":
            return jsonResult(await getMsgCopyConfig(context.client, resolved.appid));
          case "change_records":
            return jsonResult(
              await listChangeRecords(context.client, resolved.appid, {
                start,
                end,
                functions,
                limit,
                offset,
              }),
            );
          case "function_matrix":
            return jsonResult(await listFunctionMatrix(context.client));
        }
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_identity",
    {
      title: "Manage Yunxin app identifiers",
      description:
        "查询或修改 iOS Bundle Identifier、Android Package Name、HarmonyOS Package Name，以及标识安全校验开关。修改标识会影响客户端登录，写入需 confirm: true。",
      inputSchema: {
        action: z.enum(["get", "set", "set_check_bundle"]),
        app: appSchema,
        data: recordSchema.optional().describe("set 时的字段，例如 {iosbundle, packagename}"),
        checkAppBundle: z.boolean().optional().describe("set_check_bundle 时是否开启校验"),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, data, checkAppBundle, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "get") {
          return jsonResult(await getIdentity(context.client, resolved.appid));
        }
        assertWriteAllowed(context.config, confirm, "修改应用标识");
        if (action === "set") {
          if (!data) throw new Error("action=set 需要提供 data");
          return jsonResult(await updateIdentity(context.client, resolved.appid, data));
        }
        if (checkAppBundle === undefined) {
          throw new Error("action=set_check_bundle 需要提供 checkAppBundle");
        }
        return jsonResult(
          await updateCheckAppBundle(context.client, resolved.appid, {
            checkAppBundle,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_cert",
    {
      title: "Manage push certificates",
      description:
        "推送证书管理：list 查询证书；add/edit/delete 新增、修改、删除证书。证书类型包括 ios、IOSP8、IOS_PUSHKIT、HARMONY 等。删除证书必须 confirm: true。",
      inputSchema: {
        action: z.enum(["list", "add", "edit", "delete"]),
        app: appSchema,
        certtype: z.string().optional().describe("证书类型，例如 ios / IOSP8 / HARMONY"),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        fields: recordSchema.optional().describe("add/edit/delete 的接口字段"),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, certtype, limit, offset, fields, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(
            await listCerts(context.client, resolved.appid, { certtype, limit, offset }),
          );
        }
        if (!fields) throw new Error(`action=${action} 需要提供 fields`);
        assertWriteAllowed(
          context.config,
          confirm,
          action === "delete" ? "删除推送证书" : "修改推送证书",
        );
        if (action === "add") {
          return jsonResult(await addCert(context.client, resolved.appid, fields));
        }
        if (action === "edit") {
          return jsonResult(await editCert(context.client, resolved.appid, fields));
        }
        return jsonResult(await deleteCert(context.client, resolved.appid, fields));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_callback",
    {
      title: "Manage Yunxin app callbacks",
      description:
        "查询或设置第三方回调地址、超时时间、失败默认策略，以及回调事件开关。修改回调会直接影响消息投递，必须 confirm: true。",
      inputSchema: {
        action: z.enum(["get", "set"]),
        app: appSchema,
        callbackUrl: z.string().optional(),
        callbackTimeout: z.number().int().min(1).max(30).optional(),
        callbackResult: z.number().int().optional().describe("失败默认策略：1 放行，0 不放行"),
        callbackFlag: recordSchema.optional().describe("回调事件开关，例如 {p2pMsgEnable: true}"),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, callbackUrl, callbackTimeout, callbackResult, callbackFlag, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "get") {
          const config = await getImConfig(context.client, resolved.appid);
          return jsonResult({
            callbackUrl: config.callbackUrl,
            callbackTimeout: config.callBackTimeout,
            callbackResult: config.defaultCallbackResult,
            callBackFunctions: config.callBackFunctions,
          });
        }
        assertWriteAllowed(context.config, confirm, "修改第三方回调");
        return jsonResult(
          await setCallback(context.client, resolved.appid, {
            callbackUrl,
            callbackTimeout,
            callbackResult,
            callbackFlag,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_ip_whitelist",
    {
      title: "Manage app server IP whitelist",
      description:
        "服务端 API IP 白名单：list 列表、status 开关状态、set 覆盖设置、edit 修改单条、delete 删除。写入需 confirm: true。",
      inputSchema: {
        action: z.enum(["list", "status", "set", "edit", "delete"]),
        app: appSchema,
        ips: z.array(z.string()).optional().describe("action=set 时的完整 IP 列表"),
        id: z.union([z.string(), z.number()]).optional().describe("action=edit 时的记录 id"),
        ip: z.string().optional().describe("action=edit 时的新 IP"),
        ids: z.array(z.union([z.string(), z.number()])).optional().describe("action=delete 时的 id 列表"),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, ips, id, ip, ids, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(await listIpWhitelist(context.client, resolved.appid));
        }
        if (action === "status") {
          return jsonResult(await getIpWhitelistStatus(context.client, resolved.appid));
        }
        assertWriteAllowed(context.config, confirm, "修改 IP 白名单");
        if (action === "set") {
          if (!ips) throw new Error("action=set 需要提供 ips");
          return jsonResult(await setIpWhitelist(context.client, resolved.appid, ips));
        }
        if (action === "edit") {
          if (id === undefined || !ip) throw new Error("action=edit 需要提供 id 和 ip");
          return jsonResult(await editIpWhitelist(context.client, resolved.appid, id, ip));
        }
        if (!ids) throw new Error("action=delete 需要提供 ids");
        return jsonResult(await deleteIpWhitelist(context.client, resolved.appid, ids));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_custom_push",
    {
      title: "Manage custom push content",
      description:
        "自定义推送文案：list 列表、get 详情、add 新增、update 修改、delete 删除、set_default 设为默认。删除必须 confirm: true。",
      inputSchema: {
        action: z.enum(["list", "get", "add", "update", "delete", "set_default"]),
        app: appSchema,
        params: recordSchema.optional().describe("get 的查询字段"),
        data: recordSchema.optional().describe("add/update/delete/set_default 的请求体"),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, params, data, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(await listCustomPush(context.client, resolved.appid));
        }
        if (action === "get") {
          return jsonResult(await getCustomPushContent(context.client, resolved.appid, params));
        }
        assertWriteAllowed(
          context.config,
          confirm,
          action === "delete" ? "删除自定义推送" : "修改自定义推送",
        );
        if (!data) throw new Error(`action=${action} 需要提供 data`);
        if (action === "add") return jsonResult(await addCustomPush(context.client, data));
        if (action === "update") return jsonResult(await updateCustomPush(context.client, data));
        if (action === "delete") return jsonResult(await deleteCustomPush(context.client, data));
        return jsonResult(await setDefaultPushContent(context.client, data));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_app_third_push",
    {
      title: "Manage third-party push categories",
      description:
        "第三方推送消息分类配置：get 查询、set 新增/更新、delete 删除。写入需 confirm: true。",
      inputSchema: {
        action: z.enum(["get", "set", "delete"]),
        app: appSchema,
        data: recordSchema.optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, data, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "get") {
          return jsonResult(await queryThirdPushConfig(context.client, resolved.appid));
        }
        assertWriteAllowed(context.config, confirm, "修改第三方推送分类");
        if (!data) throw new Error(`action=${action} 需要提供 data`);
        if (action === "set") return jsonResult(await saveThirdPushConfig(context.client, data));
        return jsonResult(await deleteThirdPushConfig(context.client, data));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

export const appSettingSchemas = { recordSchema };
