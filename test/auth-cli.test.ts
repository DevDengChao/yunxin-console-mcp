import { describe, expect, it } from "vitest";
import { extractCookieFromCurl } from "../src/cli/auth.js";

describe("cURL cookie import", () => {
  it("extracts a bash-style cookie header", () => {
    const curl =
      "curl 'https://app.yunxin.163.com/frontApi/app/myAppList' -H 'cookie: DEMO_SESS=abc; a=1'";
    expect(extractCookieFromCurl(curl)).toBe("DEMO_SESS=abc; a=1");
  });

  it("extracts a -b cookie flag", () => {
    expect(extractCookieFromCurl("curl --cookie 'a=1; b=2' https://x")).toBe("a=1; b=2");
  });

  it("throws when no cookie is present", () => {
    expect(() => extractCookieFromCurl("curl https://x")).toThrow(/Cookie/);
  });
});
