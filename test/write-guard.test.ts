import { describe, expect, it } from "vitest";
import { isLikelyReadOnlyPath } from "../src/tools/write-guard.js";

describe("generic API read/write classification", () => {
  it.each([
    "/frontApi/app/queryAppInfo",
    "/frontApi/app/myAppList",
    "/frontApi/app/statistics/IMStats",
    "/frontApi/app/statistics/userCountStats",
    "/frontApi/app/robot/status/query",
    "/frontApi/app/serverIpWhiteListConfig/status/query",
    "/frontApi/app/function/gear/price",
    "/frontApi/app/getCustomPushContent",
  ])("treats %s as read-only", (path) => {
    expect(isLikelyReadOnlyPath(path)).toBe(true);
  });

  it.each([
    "/frontApi/app/updateInfo",
    "/frontApi/app/openfunction",
    "/frontApi/app/pushContent/delete",
    "/frontApi/app/robot/status/operate",
    "/frontApi/app/updateAppIdentify/new",
    "/frontApi/app/serverIpWhiteListConfig/edit",
    "/frontApi/app/key/refresh",
  ])("treats %s as a write", (path) => {
    expect(isLikelyReadOnlyPath(path)).toBe(false);
  });
});
