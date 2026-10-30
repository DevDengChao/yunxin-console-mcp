import fs from "node:fs";
import type { AppConfig } from "../config.js";
import {
  buildCookieHeader,
  getCookieStats,
  loadSession,
  parseCookieHeaderDetailed,
  saveSession,
  type SessionData,
} from "../auth/session.js";
import { FrontApiClient, AuthExpiredError } from "../http/client.js";
import { extractCookieFromCurl } from "./curl.js";

export { extractCookieFromCurl } from "./curl.js";

const IMPORT_USAGE =
  "用法：yunxin-console-mcp auth import --cookie \"name=value; ...\" " +
  "或 --curl \"curl ...\" / --curl-file curl.txt / --file cookie.txt / --stdin";

interface ImportInput {
  text: string;
  kind: "header" | "curl";
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0 && index + 1 < args.length) return args[index + 1];
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : undefined;
}

export async function authStatus(config: AppConfig): Promise<void> {
  const session = safeLoadSession(config);
  const stats = getCookieStats(config, session);
  const client = new FrontApiClient(config, session);
  if (!client.hasSession()) {
    console.log("未登录。请先运行：yunxin-console-mcp login");
    console.log(`会话文件：${config.sessionFile}`);
    if (stats.dropped.length > 0) {
      console.log(`无法发送的 Cookie：${stats.dropped.map((item) => item.name).join(", ")}`);
    }
    process.exitCode = 2;
    return;
  }
  try {
    const user = await client.getUserInfo();
    console.log(
      JSON.stringify(
        {
          authenticated: true,
          user,
          sessionSavedAt: session?.savedAt ?? null,
          sessionSource: config.cookieOverride ? "env" : "file",
          sessionFile: config.sessionFile,
          cookieCount: stats.usedNames.length,
          cookieNames: stats.usedNames,
          droppedCookies: stats.dropped.map((item) => item.name),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      console.log(`登录态无效：${error.message}`);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

export async function authImport(config: AppConfig, args: string[]): Promise<void> {
  const input = readImportInput(args);
  const header = input.kind === "curl" ? extractCookieFromCurl(input.text) : input.text;
  const parsed = parseCookieHeaderDetailed(header);
  const built = buildCookieHeader(parsed.cookies);

  console.log(
    `已解析 ${parsed.total} 个 Cookie，去重后 ${parsed.cookies.length} 个，可发送 ${built.usedNames.length} 个。`,
  );
  if (built.usedNames.length > 0) {
    console.log(
      `首个 Cookie：${built.usedNames[0]}；末个 Cookie：${built.usedNames[built.usedNames.length - 1]}`,
    );
  }
  if (parsed.duplicates.length > 0) {
    console.warn(
      `[auth import] 警告：重复 Cookie 名 ${parsed.duplicates.join(", ")}，已保留最后一个。`,
    );
  }
  for (const issue of parsed.issues) {
    const label = issue.name ? `${issue.name}：` : "";
    console.warn(`[auth import] 警告：${label}${issue.reason}`);
  }
  for (const drop of built.dropped) {
    console.warn(`[auth import] 警告：无法发送 Cookie ${drop.name}：${drop.reason}`);
  }

  if (built.usedNames.length === 0) {
    console.error(
      "[auth import] 没有可发送的 Cookie，未保存。请检查输入是否完整，或改用 --file/--stdin 传入完整内容。",
    );
    process.exitCode = 2;
    return;
  }

  const session: SessionData = {
    version: 1,
    savedAt: new Date().toISOString(),
    cookies: parsed.cookies,
  };
  saveSession(config, session);
  console.log(
    `已保存 ${parsed.cookies.length} 个 Cookie 到 ${config.sessionFile}`,
  );
  if (config.cookieOverride) {
    console.log("注意：当前设置了 YUNXIN_CONSOLE_COOKIE，环境变量会覆盖刚导入的 Cookie。");
  }

  // Verify the imported cookies, not the env override.
  const verifyConfig: AppConfig = { ...config, cookieOverride: undefined };
  const client = new FrontApiClient(verifyConfig, session);
  try {
    const user = await client.getUserInfo();
    console.log(`验证成功：${user.loginAccount ?? user.phone ?? "unknown"} / ${user.corpName ?? ""}`);
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      console.error(`Cookie 验证失败：${error.message}`);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

export function authLogout(config: AppConfig): void {
  for (const file of [config.sessionFile, config.storageStateFile]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`已删除 ${file}`);
    }
  }
  console.log("已退出云信控制台登录态。");
  console.log("提示：不会清空 Chrome 配置文件中的浏览器登录态。");
}

function readImportInput(args: string[]): ImportInput {
  const cookie = argValue(args, "--cookie");
  if (cookie?.trim()) return { text: cookie, kind: "header" };

  const curl = argValue(args, "--curl");
  if (curl?.trim()) return { text: curl, kind: "curl" };

  const curlFile = argValue(args, "--curl-file");
  if (curlFile) return { text: readInputFile(curlFile, "--curl-file"), kind: "curl" };

  const file = argValue(args, "--file");
  if (file) {
    const text = readInputFile(file, "--file");
    return { text, kind: looksLikeCurl(text) ? "curl" : "header" };
  }

  if (args.includes("--stdin") || args.includes("-")) {
    const text = fs.readFileSync(0, "utf8");
    if (!text.trim()) throw new Error("--stdin 没有收到内容。");
    return { text, kind: looksLikeCurl(text) ? "curl" : "header" };
  }

  throw new Error(IMPORT_USAGE);
}

function readInputFile(file: string, label: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} 读取失败：${file}（${reason}）`);
  }
}

function looksLikeCurl(text: string): boolean {
  return (
    /^\s*(?:\$ )?curl\b/i.test(text) ||
    /(?:^|\n)\s*(?:-H|--header)\s+['"]?cookie:/i.test(text)
  );
}

function safeLoadSession(config: AppConfig) {
  try {
    return loadSession(config);
  } catch (error) {
    console.error(`读取会话失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
