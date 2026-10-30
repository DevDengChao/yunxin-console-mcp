import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addDigitalHuman,
  blockUser,
  cancelStorageTask,
  closeYiDun,
  confirmStorageDelete,
  createKeyword,
  createRobot,
  createStorageTask,
  createUser,
  deleteDigitalHuman,
  deleteKeyword,
  deleteRagDoc,
  embedRagDoc,
  fuzzyQueryKeywords,
  getDigitalHuman,
  getImConfig,
  getRobot,
  getStorageTask,
  getYiDunConfig,
  getYiDunStatus,
  getYiDunSuspect,
  listDigitalHumans,
  listRagDocs,
  listRobots,
  listStorageTasks,
  listUsers,
  openYiDun,
  openYiDunProbation,
  operateRobotStatus,
  publishKeywords,
  queryKeywords,
  queryThesaurus,
  recoverStorageFiles,
  sendStorageSmsCode,
  unblockUser,
  updateDigitalHuman,
  updateImConfig,
  updateKeyword,
  updateRobot,
  updateUser,
} from "../api/im.js";
import type { ToolContext } from "./auth.js";
import { resolveAppForTool } from "./app-helpers.js";
import { errorResult, jsonResult } from "./helpers.js";
import { assertWriteAllowed } from "./write-guard.js";

const appSchema = z.union([z.string(), z.number()]).optional();
const recordSchema = z.record(z.string(), z.any());

export function registerImTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "yunxin_im_config_get",
    {
      title: "Get IM configuration",
      description:
        "读取应用完整的 IM 配置，包括总开关、鉴权方式、多端登录、撤回时长、漫游、群聊、聊天室、圈组、回调、安全通、推送等字段。",
      inputSchema: { app: appSchema },
      annotations: { readOnlyHint: true },
    },
    async ({ app }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        return jsonResult(await getImConfig(context.client, resolved.appid));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_im_config_update",
    {
      title: "Update IM configuration",
      description:
        "按字段更新 IM 配置。只传需要修改的字段，其余保持不变。每个字段会调用后台对应的写接口，并返回逐字段结果。修改服务级开关（如图中 imMainSwitch、callbackUrl）必须传 confirm: true。",
      inputSchema: {
        app: appSchema,
        imMainSwitch: z.boolean().optional().describe("IM 总开关（接口映射待真实写测试确认）"),
        authtypeset: z.string().optional().describe("登录鉴权方式，例如 '0' 静态 token"),
        kickpolicy: z.string().optional().describe("多端登录策略"),
        customKickPolicy: z.any().optional().describe("自定义多端登录策略"),
        deletemsgtime: z.number().int().min(0).optional().describe("消息撤回时长（秒）"),
        roaming: z.boolean().optional(),
        beforeHistory: z.boolean().optional(),
        pushbadgelimit: z.string().optional().describe("iOS 角标未读上限，'-1' 表示无限制"),
        sendMsgCheckFriend: z.boolean().optional().describe("非好友是否允许发送消息"),
        chatroomIONoNotify: z.boolean().optional(),
        publishoffline: z.boolean().optional(),
        chatroomMultiLogin: z.boolean().optional(),
        checkAppBundle: z.boolean().optional(),
        callbackUrl: z.string().optional(),
        callbackTimeout: z.number().int().min(1).max(30).optional(),
        callbackResult: z.number().int().optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ app, confirm, ...patch }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        assertWriteAllowed(context.config, confirm, "修改 IM 配置");
        const results = await updateImConfig(context.client, resolved.appid, patch);
        return jsonResult({
          ok: results.every((item) => item.ok),
          app: resolved,
          results,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_im_user",
    {
      title: "Manage IM test accounts",
      description:
        "测试账号管理：list 查询、create 创建、update 更新、block 封禁、unblock 解禁。封禁必须 confirm: true。",
      inputSchema: {
        action: z.enum(["list", "create", "update", "block", "unblock"]),
        app: appSchema,
        name: z.string().optional().describe("list 的名称搜索"),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        uid: z.string().optional().describe("block/unblock/update 的云信 ID"),
        data: recordSchema.optional().describe("create/update 的请求体"),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, name, limit, offset, uid, data, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(await listUsers(context.client, resolved.appid, { name, limit, offset }));
        }
        if (action === "block" || action === "unblock") {
          assertWriteAllowed(
            context.config,
            confirm,
            action === "block" ? "封禁账号" : "解禁账号",
          );
          if (!uid) throw new Error(`action=${action} 需要提供 uid`);
          return jsonResult(
            action === "block"
              ? await blockUser(context.client, resolved.appid, uid)
              : await unblockUser(context.client, resolved.appid, uid),
          );
        }
        if (!data) throw new Error(`action=${action} 需要提供 data`);
        if (action === "create") {
          return jsonResult(await createUser(context.client, resolved.appid, data));
        }
        if (!uid) throw new Error("action=update 需要提供 uid");
        return jsonResult(await updateUser(context.client, resolved.appid, uid, data));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_im_lexicon",
    {
      title: "Manage IM sensitive words",
      description:
        "敏感词/正则词条管理：list 列表、create 新增、update 修改、delete 删除、fuzzy 模糊查询、publish 发布、thesaurus 查询词库。删除和发布必须 confirm: true。",
      inputSchema: {
        action: z.enum(["list", "create", "update", "delete", "fuzzy", "publish", "thesaurus"]),
        app: appSchema,
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        keyword: z.string().optional(),
        data: recordSchema.optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, limit, offset, keyword, data, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(
            await queryKeywords(context.client, resolved.appid, { limit, offset, keyword }),
          );
        }
        if (action === "thesaurus") {
          return jsonResult(await queryThesaurus(context.client, resolved.appid));
        }
        if (action === "delete" || action === "publish") {
          assertWriteAllowed(
            context.config,
            confirm,
            action === "delete" ? "删除敏感词" : "发布敏感词",
          );
          if (action === "publish") {
            return jsonResult(await publishKeywords(context.client, resolved.appid));
          }
          if (!data) throw new Error("action=delete 需要提供 data");
          return jsonResult(await deleteKeyword(context.client, data));
        }
        if (!data) throw new Error(`action=${action} 需要提供 data`);
        if (action === "create") return jsonResult(await createKeyword(context.client, data));
        if (action === "update") return jsonResult(await updateKeyword(context.client, data));
        return jsonResult(await fuzzyQueryKeywords(context.client, data));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_im_antispam",
    {
      title: "Manage IM anti-spam / Yidun",
      description:
        "内容安全：status 查询易盾开通状态、open/close 开通/关闭、probation 免费试用、config 查询 IM 安全通配置、suspect 查询疑似处理配置。开关操作需 confirm: true。",
      inputSchema: {
        action: z.enum(["status", "open", "close", "probation", "config", "suspect"]),
        app: appSchema,
        productType: z.string().optional().describe("默认 IM"),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, productType, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        const type = productType ?? "IM";
        if (action === "status") {
          return jsonResult(await getYiDunStatus(context.client, resolved.appid, type));
        }
        if (action === "config") {
          return jsonResult(await getYiDunConfig(context.client, resolved.appid));
        }
        if (action === "suspect") {
          return jsonResult(await getYiDunSuspect(context.client, resolved.appid));
        }
        assertWriteAllowed(
          context.config,
          confirm,
          action === "close" ? "关闭安全通" : "开通安全通",
        );
        if (action === "open") {
          return jsonResult(await openYiDun(context.client, resolved.appid, type));
        }
        if (action === "close") {
          return jsonResult(await closeYiDun(context.client, resolved.appid, type));
        }
        return jsonResult(await openYiDunProbation(context.client, resolved.appid, type));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_im_robot",
    {
      title: "Manage IM robots",
      description:
        "聊天机器人：list 列表、get 详情、create 新增、update 修改、status 启停。启停必须 confirm: true。channel=1 默认机器人，channel=2 自定义机器人。",
      inputSchema: {
        action: z.enum(["list", "get", "create", "update", "status"]),
        app: appSchema,
        channel: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        params: recordSchema.optional(),
        data: recordSchema.optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, channel, limit, offset, params, data, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(
            await listRobots(context.client, resolved.appid, { channel, limit, offset }),
          );
        }
        if (action === "get") {
          return jsonResult(await getRobot(context.client, resolved.appid, params ?? {}));
        }
        if (action === "status") {
          assertWriteAllowed(context.config, confirm, "启停机器人");
          if (!data) throw new Error("action=status 需要提供 data");
          return jsonResult(await operateRobotStatus(context.client, data));
        }
        if (!data) throw new Error(`action=${action} 需要提供 data`);
        return jsonResult(
          action === "create"
            ? await createRobot(context.client, data)
            : await updateRobot(context.client, data),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_im_digital_human",
    {
      title: "Manage IM digital humans",
      description:
        "数字人管理：list 列表、get 详情、add 新增、update 修改、delete 删除、rag_list 查询知识库文档、rag_embed 训练文档、rag_delete 删除文档。删除/训练操作需 confirm: true。",
      inputSchema: {
        action: z.enum(["list", "get", "add", "update", "delete", "rag_list", "rag_embed", "rag_delete"]),
        app: appSchema,
        limit: z.number().int().min(1).max(100).optional(),
        createTime: z.number().int().optional(),
        params: recordSchema.optional(),
        data: recordSchema.optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, limit, createTime, params, data, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(
            await listDigitalHumans(context.client, resolved.appid, { limit, createTime }),
          );
        }
        if (action === "get") {
          return jsonResult(await getDigitalHuman(context.client, resolved.appid, params ?? {}));
        }
        if (action === "rag_list") {
          return jsonResult(await listRagDocs(context.client, resolved.appid, params ?? {}));
        }
        assertWriteAllowed(
          context.config,
          confirm,
          action === "delete" ? "删除数字人" : "修改数字人",
        );
        if (!data) throw new Error(`action=${action} 需要提供 data`);
        if (action === "add") return jsonResult(await addDigitalHuman(context.client, data));
        if (action === "update") return jsonResult(await updateDigitalHuman(context.client, data));
        if (action === "delete") return jsonResult(await deleteDigitalHuman(context.client, data));
        if (action === "rag_embed") return jsonResult(await embedRagDoc(context.client, data));
        return jsonResult(await deleteRagDoc(context.client, data));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "yunxin_im_storage_cleanup",
    {
      title: "Manage IM storage cleanup tasks",
      description:
        "IM 存储清理：list 任务列表、get 任务详情、create 创建任务、cancel 取消、confirm 确认删除、recover 恢复回收站文件、send_sms 发送验证码。除查询外均需 confirm: true。",
      inputSchema: {
        action: z.enum(["list", "get", "create", "cancel", "confirm", "recover", "send_sms"]),
        app: appSchema,
        params: recordSchema.optional(),
        data: recordSchema.optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ action, app, params, data, confirm }) => {
      try {
        const resolved = await resolveAppForTool(context, app);
        if (action === "list") {
          return jsonResult(await listStorageTasks(context.client, resolved.appid, params ?? {}));
        }
        if (action === "get") {
          return jsonResult(await getStorageTask(context.client, resolved.appid, params ?? {}));
        }
        assertWriteAllowed(context.config, confirm, "修改存储清理任务");
        if (!data) throw new Error(`action=${action} 需要提供 data`);
        switch (action) {
          case "create":
            return jsonResult(await createStorageTask(context.client, resolved.appid, data));
          case "cancel":
            return jsonResult(await cancelStorageTask(context.client, resolved.appid, data));
          case "confirm":
            return jsonResult(await confirmStorageDelete(context.client, resolved.appid, data));
          case "recover":
            return jsonResult(await recoverStorageFiles(context.client, resolved.appid, data));
          default:
            return jsonResult(await sendStorageSmsCode(context.client, resolved.appid, data));
        }
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
