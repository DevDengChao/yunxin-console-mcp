import { describe, expect, it } from "vitest";
import { toTimestamp, dateRange, lastSevenDays } from "../src/api/stats.js";

describe("statistics date helpers", () => {
  it("parses date-only values as Asia/Shanghai to match the console", () => {
    expect(toTimestamp("2026-10-23")).toBe(Date.UTC(2026, 9, 22, 16));
  });

  it("uses the end of day when requested", () => {
    expect(toTimestamp("2026-10-23", true)).toBe(Date.UTC(2026, 9, 23, 15, 59, 59, 999));
  });

  it("passes through epoch milliseconds", () => {
    expect(toTimestamp(1792684800000)).toBe(1792684800000);
    expect(toTimestamp("1792684800000")).toBe(1792684800000);
  });

  it("builds a range", () => {
    expect(dateRange("2026-10-23", "2026-10-29")).toEqual({
      start: Date.UTC(2026, 9, 22, 16),
      end: Date.UTC(2026, 9, 29, 15, 59, 59, 999),
    });
  });

  it("defaults to yesterday plus the previous six days", () => {
    const range = lastSevenDays();
    expect(range.end).toBeLessThan(Date.now());
    expect(range.end - range.start).toBe(7 * 24 * 60 * 60 * 1000 - 1);
    const end = new Date(range.end);
    expect(end.getUTCHours()).toBe(15);
    expect(end.getUTCMinutes()).toBe(59);
  });
});
