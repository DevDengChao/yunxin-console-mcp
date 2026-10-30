import { describe, expect, it } from "vitest";
import { extractCookieFromCurl } from "../src/cli/auth.js";
import { splitShellArgs } from "../src/cli/curl.js";

// Fake values that mirror the shape of a real console cookie header:
// the quoted `channel` value used to truncate the old regex.
const COOKIE_HEADER = [
  "locale=zh_CN",
  "_ga=GA1.1.1.1",
  "__root_domain_v=.163.com",
  "_qddaz=QD.1",
  "Hm_lvt_abc=1,2",
  "_ga_ABC=GS2.1",
  "_gcl_au=1.1",
  "_fbp=fb.1",
  "wyy_uid=00000000-0000-0000-0000-000000000000",
  'channel="h=media&t=media&clueFrom=nim&from=nim&locale=zh_CN&referrer=https%3A%2F%2Fapp.yunxin.163.com&i18nEnable=true"',
  "clueFrom=nim",
  "hb_A_source=app.yunxin.163.com",
  "hb_B_source=id.zhiqi.163.com",
  "last_login_account_type=MAIN",
  "__gsid__=00000000-0000-0000-0000-000000000000",
  "urs_t=FAKE_T",
  "urs_u=FAKE_U",
].join("; ");

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

  it("keeps cookies after a quoted value in one cookie header", () => {
    const curl = `curl 'https://app.yunxin.163.com/frontApi/app/myAppList' -H 'cookie: ${COOKIE_HEADER}'`;
    expect(extractCookieFromCurl(curl)).toBe(COOKIE_HEADER);
  });

  it("merges every cookie header instead of keeping only the first", () => {
    const first = "a=1; b=2";
    const second = "urs_t=FAKE_T; urs_u=FAKE_U";
    const curl = `curl 'https://x' \\\n  -H 'cookie: ${first}' \\\n  -H 'cookie: ${second}'`;
    expect(extractCookieFromCurl(curl)).toBe(`${first}; ${second}`);
  });

  it("handles escaped quotes in a double-quoted header", () => {
    const curl = `curl "https://x" -H "cookie: a=\\"b c\\"; urs_t=FAKE_T"`;
    expect(extractCookieFromCurl(curl)).toBe('a="b c"; urs_t=FAKE_T');
  });

  it("handles the cmd.exe ^\"cookie: ...^\" format", () => {
    const curl = [
      'curl ^"https://x^" ^',
      '  -H ^"cookie: a=1; channel=^"h=media&x=1^"; urs_t=FAKE_T; urs_u=FAKE_U^"',
    ].join("\n");
    expect(extractCookieFromCurl(curl)).toBe(
      'a=1; channel="h=media&x=1"; urs_t=FAKE_T; urs_u=FAKE_U',
    );
  });

  it("supports --header= and --cookie= inline values", () => {
    expect(extractCookieFromCurl("curl https://x --header=cookie:a=1;b=2")).toBe("a=1;b=2");
    expect(extractCookieFromCurl("curl https://x --cookie=a=1;b=2")).toBe("a=1;b=2");
  });

  it("tokenizes adjacent quoted segments", () => {
    expect(splitShellArgs("curl 'a b' \"c d\" e\\ f")).toEqual(["curl", "a b", "c d", "e f"]);
  });
});
