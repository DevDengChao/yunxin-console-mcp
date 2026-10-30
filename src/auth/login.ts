import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import type { AppConfig } from "../config.js";
import type { SessionUser } from "./session.js";
import { saveSession, sessionFromStorageState } from "./session.js";

export interface LoginOptions {
  /** Total time to wait for the user to log in. Defaults to 15 minutes. */
  timeoutMs?: number;
  /** Print progress to stdout. */
  verbose?: boolean;
}

const CONSOLE_HOME = "https://app.yunxin.163.com/global/home";
const CONSOLE_ORIGIN = "https://app.yunxin.163.com";

async function fetchUserInfo(page: Page): Promise<SessionUser | null> {
  if (!page.url().startsWith(CONSOLE_ORIGIN)) return null;
  try {
    return await page.evaluate(async () => {
      try {
        const response = await fetch("/frontApi/ent/getUserInfo", {
          credentials: "include",
          headers: { "x-requested-with": "XMLHttpRequest" },
        });
        const payload = (await response.json()) as {
          res?: number;
          msg?: Record<string, unknown>;
        };
        return payload.res === 200 && payload.msg ? (payload.msg as never) : null;
      } catch {
        return null;
      }
    });
  } catch {
    return null;
  }
}

async function launchContext(config: AppConfig): Promise<BrowserContext> {
  fs.mkdirSync(config.chromeProfileDir, { recursive: true });
  const args = [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate",
    "--start-maximized",
    "--window-position=80,80",
  ];
  try {
    return await chromium.launchPersistentContext(config.chromeProfileDir, {
      channel: "chrome",
      headless: false,
      viewport: null,
      args,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[login] Chrome 启动失败，尝试 Edge：${message.split("\n")[0]}`);
    return chromium.launchPersistentContext(config.chromeProfileDir, {
      channel: "msedge",
      headless: false,
      viewport: null,
      args,
    });
  }
}

export async function login(config: AppConfig, options: LoginOptions = {}): Promise<SessionUser> {
  const timeoutMs = options.timeoutMs ?? 30 * 60_000;
  const startedAt = Date.now();
  let context: BrowserContext | undefined;

  try {
    context = await launchContext(config);
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(CONSOLE_HOME, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.bringToFront().catch(() => undefined);

    page.on("domcontentloaded", () => {
      page
        .evaluate(() => {
          document.title = "云信 MCP 登录 - 请在此窗口登录";
        })
        .catch(() => undefined);
      page.bringToFront().catch(() => undefined);
    });

    console.log("[login] 浏览器已打开，请在窗口中完成云信控制台登录。");
    console.log("[login] 如果没看到窗口，请检查任务栏中的 Chrome/Edge 窗口。");
    console.log("[login] 登录成功会自动保存会话并关闭浏览器。");

    let lastNotice = 0;
    let lastFocus = 0;
    while (Date.now() - startedAt < timeoutMs) {
      if (page.isClosed()) {
        throw new Error("登录窗口已关闭，登录未完成。");
      }
      const user = await fetchUserInfo(page);
      if (user) {
        const state = await context.storageState();
        fs.mkdirSync(config.homeDir, { recursive: true });
        fs.writeFileSync(config.storageStateFile, `${JSON.stringify(state, null, 2)}\n`, {
          encoding: "utf8",
          mode: 0o600,
        });
        saveSession(config, sessionFromStorageState(state, user));
        console.log(
          `[login] 登录成功：${user.loginAccount ?? user.phone ?? "unknown"} / ${user.corpName ?? ""}`,
        );
        return user;
      }
      if (Date.now() - lastFocus > 20_000) {
        lastFocus = Date.now();
        await page.bringToFront().catch(() => undefined);
      }
      if (Date.now() - lastNotice > 15_000) {
        lastNotice = Date.now();
        const remaining = Math.max(0, Math.round((timeoutMs - (Date.now() - startedAt)) / 1000));
        console.log(`[login] 仍在等待登录…（剩余 ${remaining}s）`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("等待登录超时。");
  } finally {
    await context?.close().catch(() => undefined);
  }
}
