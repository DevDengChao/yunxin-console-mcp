import type { FrontApiClient, QueryValue } from "../http/client.js";

export interface AppKeyInfo {
  appKey: string;
  appSecret: string;
}

export interface CertListResult {
  appCertList: Array<Record<string, unknown>>;
  total: number;
}

export interface IpWhitelistResult {
  total: number;
  list: Array<Record<string, unknown>>;
}

export interface CustomPushListResult {
  total?: number;
  list?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export type JsonRecord = Record<string, unknown>;

function compact(input: Record<string, QueryValue>): Record<string, QueryValue> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export async function createApp(client: FrontApiClient, data: JsonRecord): Promise<unknown> {
  return client.post("/frontApi/app/addApp", undefined, data);
}

export async function updateAppInfo(
  client: FrontApiClient,
  aid: number,
  data: JsonRecord,
): Promise<unknown> {
  return client.put("/frontApi/app/updateInfo", { aid }, data);
}

export async function getAppKeys(client: FrontApiClient, aid: number): Promise<AppKeyInfo> {
  return client.get<AppKeyInfo>("/frontApi/app/key/query", { aid });
}

/** Sets a new AppSecret. This invalidates clients using the old secret. */
export async function refreshAppSecret(
  client: FrontApiClient,
  aid: number,
  appSecret?: string,
): Promise<unknown> {
  return client.get("/frontApi/app/key/refresh", compact({ aid, appSecret }));
}

/** Generates a random AppSecret. This invalidates clients using the old secret. */
export async function randomAppSecret(client: FrontApiClient, aid: number): Promise<unknown> {
  return client.get("/frontApi/app/key/randomAppSecret", { aid });
}

export async function getIdentity(client: FrontApiClient, aid: number): Promise<JsonRecord> {
  return client.post<JsonRecord>("/frontApi/app/identity/query", { aid });
}

export async function updateIdentity(
  client: FrontApiClient,
  aid: number,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/updateAppIdentify/new", { aid }, data);
}

export async function updateCheckAppBundle(
  client: FrontApiClient,
  aid: number,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/updateCheckAppBundle", { aid }, data);
}

export async function getAppSetting(client: FrontApiClient, aid: number): Promise<JsonRecord> {
  return client.post<JsonRecord>("/frontApi/app/queryAppSetting", { aid });
}

export async function listCerts(
  client: FrontApiClient,
  aid: number,
  params: { certtype?: string; limit?: number; offset?: number } = {},
): Promise<CertListResult> {
  const result = await client.post<CertListResult>("/frontApi/app/queryAppCertList", {
    aid,
    certtype: params.certtype,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });
  return { appCertList: result?.appCertList ?? [], total: result?.total ?? 0 };
}

export async function addCert(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/addAppCert", { aid, ...params });
}

export async function editCert(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/editAppCert", { aid, ...params });
}

export async function deleteCert(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/DeleteAppcert", { aid, ...params });
}

export async function getMsgCopyConfig(client: FrontApiClient, aid: number): Promise<JsonRecord> {
  return client.post<JsonRecord>("/frontApi/app/msgCopy/config/query", { aid });
}

export async function setCallback(
  client: FrontApiClient,
  aid: number,
  params: {
    callbackUrl?: string;
    callbackTimeout?: number;
    callbackResult?: number;
    callbackFlag?: JsonRecord;
  },
): Promise<unknown> {
  const result = await client.post("/frontApi/app/callbackConfig/set", {
    aid,
    callbackUrl: params.callbackUrl,
    callbackTimeout: params.callbackTimeout,
    callbackResult: params.callbackResult,
  });
  if (params.callbackFlag) {
    await client.post("/frontApi/app/callbackflag/set", { aid }, params.callbackFlag);
  }
  return result;
}

export async function getIpWhitelistStatus(
  client: FrontApiClient,
  aid: number,
): Promise<JsonRecord> {
  return client.get<JsonRecord>("/frontApi/app/serverIpWhiteListConfig/status/query", { aid });
}

export async function listIpWhitelist(
  client: FrontApiClient,
  aid: number,
): Promise<IpWhitelistResult> {
  const result = await client.get<IpWhitelistResult>("/frontApi/app/serverIpWhiteListConfig/list", {
    aid,
  });
  return { total: result?.total ?? 0, list: result?.list ?? [] };
}

export async function setIpWhitelist(
  client: FrontApiClient,
  aid: number,
  ipList: string[],
): Promise<unknown> {
  return client.post("/frontApi/app/serverIpWhiteListConfig/set", {
    aid,
    ipWitheList: ipList,
  });
}

export async function editIpWhitelist(
  client: FrontApiClient,
  aid: number,
  id: number | string,
  ip: string,
): Promise<unknown> {
  return client.post("/frontApi/app/serverIpWhiteListConfig/edit", { aid, id, ip });
}

export async function deleteIpWhitelist(
  client: FrontApiClient,
  aid: number,
  ids: Array<number | string>,
): Promise<unknown> {
  return client.post("/frontApi/app/serverIpWhiteListConfig/delete", { aid, ids });
}

export async function listCustomPush(
  client: FrontApiClient,
  aid: number,
): Promise<CustomPushListResult> {
  return client.post<CustomPushListResult>("/frontApi/app/pushContent/list", { aid });
}

export async function getCustomPushContent(
  client: FrontApiClient,
  aid: number,
  params: JsonRecord = {},
): Promise<JsonRecord> {
  return client.post<JsonRecord>("/frontApi/app/getCustomPushContent", { aid, ...params });
}

export async function addCustomPush(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/addCustomPushContent", undefined, data);
}

export async function updateCustomPush(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/updateCustomPushContent", undefined, data);
}

export async function deleteCustomPush(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/deleteCustomPushContent", undefined, data);
}

export async function setDefaultPushContent(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/pushContent/default/set", undefined, data);
}

export async function queryThirdPushConfig(
  client: FrontApiClient,
  aid: number,
): Promise<unknown> {
  return client.post("/frontApi/app/thirdPushFuncConfig/query", { aid });
}

export async function saveThirdPushConfig(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/thirdPushFuncConfig/createOrUpdate", undefined, data);
}

export async function deleteThirdPushConfig(
  client: FrontApiClient,
  data: JsonRecord,
): Promise<unknown> {
  return client.post("/frontApi/app/thirdPushFuncConfig/delete", undefined, data);
}

export async function listFunctionMatrix(client: FrontApiClient): Promise<unknown> {
  return client.post("/frontApi/app/listFunctionMatrix");
}

export async function listChangeRecords(
  client: FrontApiClient,
  aid: number,
  params: {
    start?: string;
    end?: string;
    functions?: string[];
    limit?: number;
    offset?: number;
  } = {},
): Promise<unknown> {
  return client.post("/frontApi/app/listFunctionOpeRecord", {
    aid,
    start: params.start,
    end: params.end,
    functions: params.functions,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });
}
