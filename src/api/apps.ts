import type { FrontApiClient } from "../http/client.js";

export interface AppSummary {
  appid: number;
  appname: string;
  envType?: number;
  createdAt?: number;
  openSkuList?: string[];
  imPkg?: string;
}

export interface AppListResult {
  total: number;
  list: AppSummary[];
}

export interface AppInfo {
  aid: number;
  appname: string;
  appKey?: string;
  category?: number;
  cid?: number;
  createdAt?: number;
  envtype?: number;
  region?: string;
  testAppTag?: boolean;
  [key: string]: unknown;
}

export interface AppConfig {
  imCurrPkg?: string;
  imPro?: Record<string, unknown>;
  imQuick?: Record<string, unknown>;
  imTry?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ImConfig {
  appname?: string;
  imMainSwitch?: boolean;
  imPkg?: string;
  imRegion?: string;
  authtypeset?: string;
  kickpolicy?: string;
  deletemsgtime?: number;
  roaming?: boolean;
  history?: string;
  beforeHistory?: boolean;
  sendMsgCheckFriend?: boolean;
  chatroom?: boolean;
  chatroomMultiLogin?: boolean;
  chatroomIONoNotify?: boolean;
  qchat?: boolean;
  superTeam?: boolean;
  pushbadgelimit?: string;
  callBackFunctions?: Record<string, boolean>;
  [key: string]: unknown;
}

export async function listApps(
  client: FrontApiClient,
  params: { keyword?: string; limit?: number; offset?: number } = {},
): Promise<AppListResult> {
  const result = await client.post<AppListResult>("/frontApi/app/myAppList", {
    keyword: params.keyword ?? "",
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });
  return {
    total: result?.total ?? 0,
    list: result?.list ?? [],
  };
}

export async function listAllApps(client: FrontApiClient): Promise<AppSummary[]> {
  const pageSize = 100;
  const apps: AppSummary[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await listApps(client, { limit: pageSize, offset });
    apps.push(...page.list);
    if (page.list.length === 0 || apps.length >= page.total) break;
    if (offset > 10_000) break;
  }
  return apps;
}

export async function getAppInfo(client: FrontApiClient, aid: number): Promise<AppInfo> {
  return client.get<AppInfo>("/frontApi/app/queryAppInfo", { aid });
}

export async function getAppConfig(client: FrontApiClient, aid: number): Promise<AppConfig> {
  return client.get<AppConfig>("/frontApi/app/appConfig", { aid });
}

export async function getImConfig(client: FrontApiClient, aid: number): Promise<ImConfig> {
  return client.get<ImConfig>("/frontApi/app/im/config/query", { aid });
}

export class AppResolutionError extends Error {
  constructor(
    message: string,
    readonly apps: AppSummary[] = [],
  ) {
    super(message);
    this.name = "AppResolutionError";
  }
}

export interface ResolveAppOptions {
  /** App name or appid supplied by the tool caller. */
  app?: string | number;
  /** Fallback from YUNXIN_CONSOLE_DEFAULT_APP. */
  defaultApp?: string;
}

export async function resolveApp(
  client: FrontApiClient,
  options: ResolveAppOptions,
): Promise<AppSummary> {
  const input = options.app ?? options.defaultApp;
  if (input === undefined || input === null || `${input}`.trim() === "") {
    throw new AppResolutionError(
      "未指定应用。请传入 app（应用名称或 appid），或设置 YUNXIN_CONSOLE_DEFAULT_APP。",
    );
  }

  const asString = `${input}`.trim();
  if (/^\d+$/.test(asString)) {
    const aid = Number(asString);
    const apps = await listAllApps(client);
    const found = apps.find((item) => item.appid === aid);
    if (found) return found;
    // The app may exist but require a direct lookup.
    return { appid: aid, appname: `app-${aid}` };
  }

  const apps = await listAllApps(client);
  const lower = asString.toLowerCase();
  const exact = apps.filter((item) => item.appname?.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new AppResolutionError(`应用名 "${asString}" 匹配到多个应用，请改用 appid。`, exact);
  }
  const fuzzy = apps.filter((item) => item.appname?.toLowerCase().includes(lower));
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) {
    throw new AppResolutionError(
      `应用名 "${asString}" 匹配到多个应用：${fuzzy.map((item) => item.appname).join(", ")}。请改用 appid。`,
      fuzzy,
    );
  }
  throw new AppResolutionError(
    `未找到应用 "${asString}"。可用应用：${apps.map((item) => `${item.appname}(${item.appid})`).join(", ") || "无"}`,
    apps,
  );
}
