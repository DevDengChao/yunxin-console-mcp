#!/usr/bin/env node
/**
 * Read-only live smoke test. Requires a valid session created by:
 *   node dist/cli.js login
 * or
 *   node dist/cli.js auth import --cookie "..."
 *
 * Usage:
 *   npm run build
 *   npm run smoke
 *   YUNXIN_SMOKE_APP=DemoApp npm run smoke
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js"],
  env: process.env,
  stderr: "inherit",
});
const client = new Client({ name: "yunxin-console-smoke", version: "0.0.0" });

async function call(name, args = {}) {
  const response = await client.callTool({ name, arguments: args });
  const text = response.content?.[0]?.text ?? "";
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (response.isError) {
    throw new Error(`${name}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

await client.connect(transport);

try {
  const auth = await call("yunxin_auth_status");
  if (!auth.authenticated) {
    console.error("SMOKE FAILED: not logged in.");
    process.exitCode = 2;
  } else {
    const apps = await call("yunxin_apps_list", { limit: 20 });
    const appName = process.env.YUNXIN_SMOKE_APP || apps.list?.[0]?.appname;
    if (!appName) throw new Error("no applications found");

    const app = await call("yunxin_app_get", { app: appName, includeImConfig: true });
    const im = await call("yunxin_im_config_get", { app: appName });
    const users = await call("yunxin_im_user", { app: appName, action: "list", limit: 5 });
    const userDay = await call("yunxin_stats_users", { app: appName, action: "day" });
    const imStats = await call("yunxin_stats_im", {
      app: appName,
      tab: "MESSAGE_COUNT",
      childTab: "SINGLE_MESSAGE_COUNT",
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          account: auth.user?.loginAccount,
          corp: auth.user?.corpName,
          apps: apps.list?.map((item) => `${item.appname}(${item.appid})`),
          app: {
            name: app.info?.appname,
            appid: app.app?.appid,
            imPkg: app.config?.imCurrPkg,
            imMainSwitch: im.imMainSwitch,
            deletemsgtime: im.deletemsgtime,
          },
          testAccounts: users.total ?? 0,
          userDay: {
            addUser: userDay.addUser,
            activeUser: userDay.activeUser,
            totalUser: userDay.totalUser,
          },
          imStatsPoints: imStats.total ?? 0,
        },
        null,
        2,
      ),
    );
    console.log("SMOKE OK");
  }
} catch (error) {
  console.error(`SMOKE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
