import fs from "node:fs";
import type { AppConfig } from "../config.js";
import { loadSession, saveSession, sessionFromCookieHeader } from "../auth/session.js";
import { FrontApiClient, AuthExpiredError } from "../http/client.js";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0 && index + 1 < args.length) return args[index + 1];
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : undefined;
}

export async function authStatus(config: AppConfig): Promise<void> {
  const session = safeLoadSession(config);
  const client = new FrontApiClient(config, session);
  if (!client.hasSession()) {
    console.log("未登录。请先运行：yunxin-console-mcp login");
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
  const cookie = argValue(args, "--cookie");
  const file = argValue(args, "--file");
  let header = cookie;
  if (!header && file) {
    header = fs.readFileSync(file, "utf8").trim();
  }
  if (!header) {
    throw new Error("用法：yunxin-console-mcp auth import --cookie \"name=value; ...\" 或 --file cookies.txt");
  }

  const session = sessionFromCookieHeader(header);
  saveSession(config, session);
  console.log(`已保存 ${session.cookies.length} 个 Cookie 到 ${config.sessionFile}`);
  if (config.cookieOverride) {
    console.log("注意：当前设置了 YUNXIN_CONSOLE_COOKIE，环境变量会覆盖刚导入的 Cookie。");
  }

  const client = new FrontApiClient(config, session);
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
}

function safeLoadSession(config: AppConfig) {
  try {
    return loadSession(config);
  } catch (error) {
    console.error(`读取会话失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
