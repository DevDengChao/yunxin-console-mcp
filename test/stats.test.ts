import { describe, expect, it } from "vitest";
import { toTimestamp, dateRange } from "../src/api/stats.js";

describe("statistics date helpers", () => {
  it("parses date-only values as UTC to match the console", () => {
    expect(toTimestamp("2026-10-23")).toBe(Date.UTC(2026, 9, 23));
  });

  it("uses the end of day when requested", () => {
    expect(toTimestamp("2026-10-23", true)).toBe(Date.UTC(2026, 9, 23, 23, 59, 59, 999));
  });

  it("passes through epoch milliseconds", () => {
    expect(toTimestamp(1792684800000)).toBe(1792684800000);
    expect(toTimestamp("1792684800000")).toBe(1792684800000);
  });

  it("builds a range", () => {
    expect(dateRange("2026-10-23", "2026-10-29")).toEqual({
      start: Date.UTC(2026, 9, 23),
      end: Date.UTC(2026, 9, 29, 23, 59, 59, 999),
    });
  });
});
