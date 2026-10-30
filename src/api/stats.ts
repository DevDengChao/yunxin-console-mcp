import type { FrontApiClient } from "../http/client.js";

export type DateInput = string | number;

export interface DateRange {
  start?: number;
  end?: number;
}

/** Accepts epoch milliseconds or YYYY-MM-DD (interpreted as Asia/Shanghai, matching the console UI). */
export function toTimestamp(value: DateInput | undefined, endOfDay = false): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (/^\d+$/.test(value)) return Number(value);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    return Date.parse(
      `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`,
    );
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function dateRange(start?: DateInput, end?: DateInput): DateRange {
  return { start: toTimestamp(start), end: toTimestamp(end, true) };
}

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Default window used by the console: yesterday plus the previous six days, in Asia/Shanghai. */
export function lastSevenDays(): { start: number; end: number } {
  const chinaNow = new Date(Date.now() + CHINA_OFFSET_MS);
  const year = chinaNow.getUTCFullYear();
  const month = chinaNow.getUTCMonth();
  const day = chinaNow.getUTCDate();
  const end = Date.UTC(year, month, day - 1, 23, 59, 59, 999) - CHINA_OFFSET_MS;
  const start = end - (7 * 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export async function getUserDayDetail(
  client: FrontApiClient,
  aid: number,
  date?: DateInput,
): Promise<unknown> {
  return client.post("/frontApi/app/statistics/userDayDetail", {
    appId: aid,
    date: toTimestamp(date),
  });
}

export async function getUserCountStats(
  client: FrontApiClient,
  aid: number,
  params: {
    start?: DateInput;
    end?: DateInput;
    datacycle?: "BYDAY" | "BYHOUR" | string;
    type?: number;
    os?: string;
  } = {},
): Promise<unknown> {
  const range = dateRange(params.start, params.end);
  const fallback = lastSevenDays();
  return client.post("/frontApi/app/statistics/userCountStats", {
    appId: aid,
    datacycle: params.datacycle ?? "BYDAY",
    type: params.type ?? 1,
    start: range.start ?? fallback.start,
    end: range.end ?? fallback.end,
    os: params.os,
  });
}

export async function getUserProvinceStats(
  client: FrontApiClient,
  aid: number,
  params: { start?: DateInput; end?: DateInput } = {},
): Promise<unknown> {
  const range = dateRange(params.start, params.end);
  const fallback = lastSevenDays();
  return client.post("/frontApi/app/statistics/userProvinceStats", {
    appId: aid,
    start: range.start ?? fallback.start,
    end: range.end ?? fallback.end,
  });
}

export async function getUserCityStats(
  client: FrontApiClient,
  aid: number,
  params: { start?: DateInput; end?: DateInput; province?: string } = {},
): Promise<unknown> {
  const range = dateRange(params.start, params.end);
  const fallback = lastSevenDays();
  return client.post("/frontApi/app/statistics/userCityStats", {
    appId: aid,
    start: range.start ?? fallback.start,
    end: range.end ?? fallback.end,
    province: params.province,
  });
}

export async function getUserRealTime(client: FrontApiClient, aid: number): Promise<unknown> {
  return client.post("/frontApi/app/statistics/userRealTime", { appId: aid });
}

export async function getImStats(
  client: FrontApiClient,
  aid: number,
  params: {
    tab: string;
    childTab?: string;
    start?: DateInput;
    end?: DateInput;
    productNumber?: string;
    yiDunBusinessId?: string;
  },
): Promise<unknown> {
  const range = dateRange(params.start, params.end);
  const fallback = lastSevenDays();
  return client.post("/frontApi/app/statistics/IMStats", {
    appId: aid,
    tab: params.tab,
    childTab: params.childTab,
    start: range.start ?? fallback.start,
    end: range.end ?? fallback.end,
    productNumber: params.productNumber,
    yiDunBusinessId: params.yiDunBusinessId,
  });
}

export async function getAppFuncStats(client: FrontApiClient, aid: number): Promise<unknown> {
  return client.post("/frontApi/app/statistic/appFunc", { aid });
}

export async function getYiDunStatusStats(
  client: FrontApiClient,
  aid: number,
  type = "IM",
): Promise<unknown> {
  return client.post("/frontApi/app/statistics/yiDunStatus", { aid, type });
}

export async function notifyDelayException(
  client: FrontApiClient,
  type: string,
): Promise<unknown> {
  return client.post("/frontApi/app/statistics/delay/exception/notify", { type });
}
