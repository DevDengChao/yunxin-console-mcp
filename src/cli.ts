#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { SERVER_NAME, VERSION } from "./version.js";

function printHelp(): void {
  console.log(`${SERVER_NAME} v${VERSION}

用法：
  yunxin-console-mcp              启动 MCP Server（stdio）
  yunxin-console-mcp login        打开 Chrome 完成一次登录并保存会话
  yunxin-console-mcp auth status  检查登录态
  yunxin-console-mcp auth import --cookie "name=value; ..."
                                  或 --curl "curl ..." / --curl-file curl.txt
                                  / --file cookie.txt / --stdin
                                  导入浏览器 Cookie（长 Cookie 建议用文件或管道）
  yunxin-console-mcp auth logout  删除本地登录态

环境变量：
  YUNXIN_CONSOLE_HOME           会话目录（默认系统配置目录）
  YUNXIN_CONSOLE_COOKIE         直接提供 Cookie，优先于本地会话
  YUNXIN_CONSOLE_DEFAULT_APP    默认应用名称或 appid
  YUNXIN_CONSOLE_ALLOW_WRITE    false 时禁用所有写操作（默认 true）
  YUNXIN_CONSOLE_TIMEOUT_MS     HTTP 超时，默认 15000
`);
}

async function serve(): Promise<void> {
  const { createServer } = await import("./server.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] v${VERSION} running on stdio`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const config = loadConfig();

  switch (command) {
    case undefined:
    case "serve":
      await serve();
      break;
    case "login": {
      const { login } = await import("./auth/login.js");
      const timeout = Number.parseInt(process.env.YUNXIN_CONSOLE_LOGIN_TIMEOUT_MS ?? "", 10);
      await login(config, { timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined });
      break;
    }
    case "auth": {
      const { authStatus, authImport, authLogout } = await import("./cli/auth.js");
      const sub = args[0];
      if (sub === "status") await authStatus(config);
      else if (sub === "import") await authImport(config, args.slice(1));
      else if (sub === "logout" || sub === "clear") authLogout(config);
      else {
        printHelp();
        process.exitCode = 1;
      }
      break;
    }
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    case "--help":
    case "-h":
    case "help":
      printHelp();
      break;
    default:
      console.error(`未知命令：${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
