import type { FrontApiClient } from "../http/client.js";

export type DateInput = string | number;

export interface DateRange {
  start?: number;
  end?: number;
}

/** Accepts epoch milliseconds or YYYY-MM-DD (interpreted as UTC, matching the console UI). */
export function toTimestamp(value: DateInput | undefined, endOfDay = false): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (/^\d+$/.test(value)) return Number(value);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    return Date.parse(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function dateRange(start?: DateInput, end?: DateInput): DateRange {
  return { start: toTimestamp(start), end: toTimestamp(end, true) };
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
  return client.post("/frontApi/app/statistics/userCountStats", {
    appId: aid,
    datacycle: params.datacycle ?? "BYDAY",
    type: params.type ?? 1,
    start: range.start,
    end: range.end,
    os: params.os,
  });
}

export async function getUserProvinceStats(
  client: FrontApiClient,
  aid: number,
  params: { start?: DateInput; end?: DateInput } = {},
): Promise<unknown> {
  const range = dateRange(params.start, params.end);
  return client.post("/frontApi/app/statistics/userProvinceStats", {
    appId: aid,
    start: range.start,
    end: range.end,
  });
}

export async function getUserCityStats(
  client: FrontApiClient,
  aid: number,
  params: { start?: DateInput; end?: DateInput; province?: string } = {},
): Promise<unknown> {
  const range = dateRange(params.start, params.end);
  return client.post("/frontApi/app/statistics/userCityStats", {
    appId: aid,
    start: range.start,
    end: range.end,
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
  return client.post("/frontApi/app/statistics/IMStats", {
    appId: aid,
    tab: params.tab,
    childTab: params.childTab,
    start: range.start,
    end: range.end,
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
