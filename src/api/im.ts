import type { FrontApiClient } from "../http/client.js";
import type { ImConfig } from "./apps.js";

export type JsonRecord = Record<string, unknown>;

export interface ImConfigPatch {
  imMainSwitch?: boolean;
  authtypeset?: string;
  kickpolicy?: string;
  customKickPolicy?: unknown;
  deletemsgtime?: number;
  roaming?: boolean;
  beforeHistory?: boolean;
  pushbadgelimit?: string;
  sendMsgCheckFriend?: boolean;
  chatroomIONoNotify?: boolean;
  publishoffline?: boolean;
  chatroomMultiLogin?: boolean;
  checkAppBundle?: boolean;
  callbackUrl?: string;
  callbackTimeout?: number;
  callbackResult?: number;
}

export interface PatchResult {
  field: string;
  ok: boolean;
  response?: unknown;
  error?: string;
}

export async function getImConfig(client: FrontApiClient, aid: number): Promise<ImConfig> {
  return client.get<ImConfig>("/frontApi/app/im/config/query", { aid });
}

async function call(
  client: FrontApiClient,
  field: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
  body?: unknown,
  method: "get" | "post" = "post",
): Promise<PatchResult> {
  try {
    const response =
      method === "get"
        ? await client.get(path, query)
        : body
          ? await client.post(path, query, body)
          : await client.post(path, query);
    return { field, ok: true, response };
  } catch (error) {
    return { field, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Applies a subset of IM settings. Each field maps to the same endpoint used by the
 * console UI. Fields that are not supplied are left untouched.
 */
export async function updateImConfig(
  client: FrontApiClient,
  aid: number,
  patch: ImConfigPatch,
): Promise<PatchResult[]> {
  const results: PatchResult[] = [];

  if (patch.imMainSwitch !== undefined) {
    results.push(
      await call(
        client,
        "imMainSwitch",
        "/frontApi/app/openfunction",
        {
          aid,
          function: "IM_MAIN_SWITCH",
          opetype: patch.imMainSwitch ? "open" : "close",
        },
        undefined,
        "get",
      ),
    );
  }
  if (patch.authtypeset !== undefined) {
    results.push(
      await call(client, "authtypeset", "/frontApi/app/updateAuthTypeSet", {
        aid,
        typeSet: patch.authtypeset,
      }),
    );
  }
  if (patch.kickpolicy !== undefined || patch.customKickPolicy !== undefined) {
    results.push(
      await call(client, "kickpolicy", "/frontApi/app/updateKickpolicy", {
        aid,
        kickpolicy: patch.kickpolicy,
        customKickPolicy: patch.customKickPolicy
          ? JSON.stringify(patch.customKickPolicy)
          : undefined,
      }),
    );
  }
  if (patch.deletemsgtime !== undefined) {
    results.push(
      await call(client, "deletemsgtime", "/frontApi/app/updateDeletemsgtime", {
        aid,
        deletemsgtime: patch.deletemsgtime,
      }),
    );
  }
  if (patch.roaming !== undefined) {
    results.push(
      await call(client, "roaming", "/frontApi/app/updateRoaming", { aid, roaming: patch.roaming }),
    );
  }
  if (patch.beforeHistory !== undefined) {
    results.push(
      await call(client, "beforeHistory", "/frontApi/app/updateBeforeHistory", {
        aid,
        beforeHistory: patch.beforeHistory,
      }),
    );
  }
  if (patch.pushbadgelimit !== undefined) {
    results.push(
      await call(client, "pushbadgelimit", "/frontApi/app/updateIosUnreadMsgUpperLimit", {
        aid,
        upperLimit: patch.pushbadgelimit,
      }),
    );
  }
  if (patch.sendMsgCheckFriend !== undefined) {
    results.push(
      await call(client, "sendMsgCheckFriend", "/frontApi/app/msgfriendcheck/set", {
        aid,
        checkType: patch.sendMsgCheckFriend ? 1 : 0,
      }),
    );
  }
  if (patch.chatroomIONoNotify !== undefined) {
    results.push(
      await call(client, "chatroomIONoNotify", "/frontApi/app/updateChatroomIONoNotify", {
        aid,
        noNotify: patch.chatroomIONoNotify,
      }),
    );
  }
  if (patch.publishoffline !== undefined) {
    results.push(
      await call(client, "publishoffline", "/frontApi/app/updatePublishOffline", {
        aid,
        publishOffline: patch.publishoffline,
      }),
    );
  }
  if (patch.chatroomMultiLogin !== undefined) {
    results.push(
      await call(client, "chatroomMultiLogin", "/frontApi/app/updateChatroomKickpolicy", {
        aid,
        multiWayLogin: patch.chatroomMultiLogin,
      }),
    );
  }
  if (patch.checkAppBundle !== undefined) {
    results.push(
      await call(
        client,
        "checkAppBundle",
        "/frontApi/app/updateCheckAppBundle",
        { aid },
        { checkAppBundle: patch.checkAppBundle },
      ),
    );
  }
  if (
    patch.callbackUrl !== undefined ||
    patch.callbackTimeout !== undefined ||
    patch.callbackResult !== undefined
  ) {
    results.push(
      await call(client, "callback", "/frontApi/app/callbackConfig/set", {
        aid,
        callbackUrl: patch.callbackUrl,
        callbackTimeout: patch.callbackTimeout,
        callbackResult: patch.callbackResult,
      }),
    );
  }

  return results;
}

export async function toggleFunction(
  client: FrontApiClient,
  aid: number,
  functionCode: string,
  open: boolean,
): Promise<unknown> {
  return client.get("/frontApi/app/openfunction", {
    aid,
    function: functionCode,
    opetype: open ? "open" : "close",
  });
}

/* ------------------------------------------------------------------ */
/* Test accounts                                                       */
/* ------------------------------------------------------------------ */

export async function listUsers(
  client: FrontApiClient,
  aid: number,
  params: { name?: string; limit?: number; offset?: number } = {},
): Promise<unknown> {
  return client.get("/frontApi/app/user/list", {
    aid,
    name: params.name ?? "",
    limit: params.limit ?? 10,
    offset: params.offset ?? 0,
  });
}

export async function createUser(
  client: FrontApiClient,
  aid: number,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/user/create", { aid }, data);
}

export async function updateUser(
  client: FrontApiClient,
  aid: number,
  userid: string,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/user/update", { aid, userid }, data);
}

export async function blockUser(
  client: FrontApiClient,
  aid: number,
  uid: string,
): Promise<unknown> {
  return client.post("/frontApi/app/user/block", { aid, uid });
}

export async function unblockUser(
  client: FrontApiClient,
  aid: number,
  uid: string,
): Promise<unknown> {
  return client.post("/frontApi/app/user/unblock", { aid, uid });
}

/* ------------------------------------------------------------------ */
/* Sensitive words / anti-spam                                         */
/* ------------------------------------------------------------------ */

export async function queryKeywords(
  client: FrontApiClient,
  aid: number,
  params: { limit?: number; offset?: number; keyword?: string } = {},
): Promise<unknown> {
  return client.post("/frontApi/app/cantispam/keyword/query", {
    aid,
    limit: params.limit ?? 10,
    offset: params.offset ?? 0,
    keyword: params.keyword,
  });
}

export async function createKeyword(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/cantispam/keyword/create", undefined, data);
}

export async function updateKeyword(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/cantispam/keyword/update", undefined, data);
}

export async function deleteKeyword(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/cantispam/keyword/delete", undefined, data);
}

export async function fuzzyQueryKeywords(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/cantispam/keyword/fuzzyQuery", undefined, data);
}

export async function publishKeywords(client: FrontApiClient, aid: number): Promise<unknown> {
  return client.post("/frontApi/app/cantispam/publish", { aid });
}

export async function queryThesaurus(client: FrontApiClient, aid: number): Promise<unknown> {
  return client.post("/frontApi/app/cantispam/thesaurus/query", { aid });
}

export async function getYiDunStatus(
  client: FrontApiClient,
  aid: number,
  productType = "IM",
): Promise<unknown> {
  return client.post("/frontApi/app/yiDunAntiSpamStatus/query", { aid, productType });
}

export async function openYiDun(
  client: FrontApiClient,
  aid: number,
  productType = "IM",
): Promise<unknown> {
  return client.post("/frontApi/app/yiDunAntiSpam/open", { aid, productType });
}

export async function closeYiDun(
  client: FrontApiClient,
  aid: number,
  productType = "IM",
): Promise<unknown> {
  return client.post("/frontApi/app/yiDunAntiSpam/close", { aid, productType });
}

export async function openYiDunProbation(
  client: FrontApiClient,
  aid: number,
  productType = "IM",
): Promise<unknown> {
  return client.post("/frontApi/app/yiDunAntiSpam/probation/open", { aid, productType });
}

export async function getYiDunConfig(
  client: FrontApiClient,
  aid: number,
): Promise<JsonRecord> {
  return client.post<JsonRecord>("/frontApi/yiDun/im/config/query", { aid });
}

export async function getYiDunSuspect(
  client: FrontApiClient,
  aid: number,
): Promise<unknown> {
  return client.post("/frontApi/yiDun/suspect/v5/query", { aid });
}

/* ------------------------------------------------------------------ */
/* Robots / digital humans                                             */
/* ------------------------------------------------------------------ */

export async function listRobots(
  client: FrontApiClient,
  aid: number,
  params: { channel?: number; limit?: number; offset?: number } = {},
): Promise<unknown> {
  return client.post("/frontApi/app/robot/info/list", {
    aid,
    channel: params.channel ?? 1,
    limit: params.limit ?? 10,
    offset: params.offset ?? 0,
  });
}

export async function getRobot(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/robot/info/query", { aid, ...params });
}

export async function createRobot(client: FrontApiClient, data: JsonRecord): Promise<unknown> {
  return client.post("/frontApi/app/robot/info/create", undefined, data);
}

export async function updateRobot(client: FrontApiClient, data: JsonRecord): Promise<unknown> {
  return client.post("/frontApi/app/robot/info/update", undefined, data);
}

export async function operateRobotStatus(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/robot/status/operate", undefined, data);
}

export async function listDigitalHumans(
  client: FrontApiClient,
  aid: number,
  params: { limit?: number; createTime?: number } = {},
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/list", {
    aid,
    limit: params.limit ?? 20,
    createTime: params.createTime,
  });
}

export async function getDigitalHuman(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/query", { aid, ...params });
}

export async function addDigitalHuman(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/add", undefined, data);
}

export async function updateDigitalHuman(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/update", undefined, data);
}

export async function deleteDigitalHuman(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/delete", undefined, data);
}

export async function listRagDocs(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord = {},
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/ragDocList/query", { aid, ...params });
}

export async function embedRagDoc(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/ragDoc/embed", undefined, data);
}

export async function deleteRagDoc(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/digitalMan/ragDoc/delete", undefined, data);
}

/* ------------------------------------------------------------------ */
/* IM storage cleanup                                                  */
/* ------------------------------------------------------------------ */

export async function listStorageTasks(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord = {},
): Promise<unknown> {
  return client.post("/frontApi/app/fileStorageCleanUp/list", { aid, ...params });
}

export async function getStorageTask(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/fileStorageCleanUp/query", { aid, ...params });
}

export async function createStorageTask(
  client: FrontApiClient,
  aid: number,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/fileStorageCleanUp/create", { aid }, data);
}

export async function cancelStorageTask(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/fileStorageCleanUp/cancelTask", { aid, ...params });
}

export async function confirmStorageDelete(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/fileStorageCleanUp/confirmDelete", { aid, ...params });
}

export async function recoverStorageFiles(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/fileStorageCleanUp/recoverRecycledFiles", { aid, ...params });
}

export async function sendStorageSmsCode(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord = {},
): Promise<unknown> {
  return client.post("/frontApi/app/fileStorageCleanUp/sendSmsCode", { aid, ...params });
}
