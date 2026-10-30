# yunxin-console-mcp

网易云信控制台 MCP Server。官方 [yunxin-mcp-server](https://github.com/netease-im/yunxin-mcp-server)
覆盖的是服务端 IM/RTC API；本项目补全**应用后台管理**能力：应用管理、AppKey/AppSecret、
回调、证书、推送配置、IM 功能开关、测试账号、敏感词、数字人和统计。

> 本项目调用的是云信控制台内部 `frontApi`，属于非官方实现。网易调整控制台后接口可能变化，
> 请自行评估风险。

## 功能

- **应用管理**：应用列表、应用详情、创建/修改应用、AppKey/AppSecret
- **应用配置**：标识管理、推送证书、第三方回调、消息抄送（只读）、IP 白名单、自定义推送、第三方推送分类、功能变更记录
- **IM 管理**：完整 IM 配置读取、按字段更新、测试账号、敏感词、安全通/反垃圾、机器人、数字人、存储清理
- **数据统计**：用户增长、地域分布、IM 消息数、群组/聊天室/推送/安全通、功能使用统计
- **通用兜底**：`yunxin_api_call` 可调用任意 `/frontApi` 接口，覆盖尚未封装的能力

## 环境要求

- Node.js 20+
- 本机安装 Google Chrome 或 Microsoft Edge（仅首次登录使用）

## 安装

```bash
npm install -g yunxin-console-mcp
# 或从源码运行
npm install
npm run build
```

## 首次登录

控制台使用 Cookie 会话。运行一次：

```bash
yunxin-console-mcp login
```

会打开一个专用 Chrome 配置窗口。登录成功后会保存 Cookie 到用户配置目录并自动关闭浏览器。
之后 MCP Server 直接使用该会话，不再需要浏览器常驻。

如果不想打开浏览器，也可以从 DevTools 的 Network 面板复制请求头里的 Cookie：

```bash
yunxin-console-mcp auth import --cookie "cookie1=value1; cookie2=value2"
```

或者直接在 Network 面板右键请求 → Copy → Copy as cURL，然后粘贴：

```bash
yunxin-console-mcp auth import --curl "curl 'https://app.yunxin.163.com/frontApi/...' -H 'cookie: ...'"
# 或把内容保存到文件
yunxin-console-mcp auth import --curl-file curl.txt
```

检查登录态：

```bash
yunxin-console-mcp auth status
```

退出登录：

```bash
yunxin-console-mcp auth logout
```

## MCP 客户端配置

Claude Desktop / Cursor / OpenCode 等支持 stdio 的客户端：

```json
{
  "mcpServers": {
    "yunxin-console": {
      "command": "npx",
      "args": ["-y", "yunxin-console-mcp"],
      "env": {
        "YUNXIN_CONSOLE_DEFAULT_APP": "DemoApp"
      }
    }
  }
}
```

如果从源码运行，把 `command` 改为 `node`，`args` 改为 `["E:/path/to/yunxin-console-mcp/dist/cli.js"]`。

## 工具列表

| 工具 | 作用 |
| --- | --- |
| `yunxin_auth_status` | 检查登录态、当前账号、企业信息 |
| `yunxin_apps_list` | 应用列表，支持关键字和分页 |
| `yunxin_app_get` | 应用信息 + 产品配置（可选 IM 配置） |
| `yunxin_app_admin` | 创建/修改应用、应用设置、消息抄送、变更记录、功能矩阵 |
| `yunxin_app_keys` | 查询 AppKey/AppSecret、重置密钥 |
| `yunxin_app_identity` | iOS/Android/HarmonyOS 标识管理 |
| `yunxin_app_cert` | APNs/FCM/华为/小米/OPPO/vivo 证书增删改查 |
| `yunxin_app_callback` | 第三方回调地址、超时、默认策略、事件开关 |
| `yunxin_app_ip_whitelist` | 服务端 IP 白名单 |
| `yunxin_app_custom_push` | 自定义推送文案 |
| `yunxin_app_third_push` | 第三方推送消息分类 |
| `yunxin_im_config_get` | 读取完整 IM 配置 |
| `yunxin_im_config_update` | 按字段更新 IM 配置 |
| `yunxin_im_user` | 测试账号列表/创建/更新/封禁/解禁 |
| `yunxin_im_lexicon` | 敏感词/正则词条管理 |
| `yunxin_im_antispam` | 安全通/易盾状态、开关、配置、疑似处理 |
| `yunxin_im_robot` | 机器人管理 |
| `yunxin_im_digital_human` | 数字人和知识库文档 |
| `yunxin_im_storage_cleanup` | IM 存储清理任务 |
| `yunxin_stats_users` | 用户增长、趋势、地域、实时在线 |
| `yunxin_stats_im` | IM 消息与相关指标统计 |
| `yunxin_stats_app` | 功能使用和安全通状态统计 |
| `yunxin_api_call` | 调用任意 `/frontApi` 接口 |

多数工具使用 `action` 参数区分读写操作；`app` 参数支持应用名称或 appid。

## 安全模型

- **写操作默认开启**。如需只读模式，设置 `YUNXIN_CONSOLE_ALLOW_WRITE=false`。
- 删除、重置密钥、封禁、发布、存储清理等破坏性操作必须传 `confirm: true`。
- AppSecret 默认打码；需要完整值时显式传 `includeSecret: true`。
- 所有非 GET 请求写入本地审计日志，Cookie、AppSecret、Token 等字段自动脱敏。
- 审计日志默认位于：
  - Windows：`%APPDATA%\yunxin-console-mcp\audit.log`
  - macOS/Linux：`~/.config/yunxin-console-mcp/audit.log`

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `YUNXIN_CONSOLE_HOME` | 系统配置目录 | 会话、Chrome 配置和审计日志目录 |
| `YUNXIN_CONSOLE_COOKIE` | - | 直接提供 Cookie，优先于本地会话 |
| `YUNXIN_CONSOLE_DEFAULT_APP` | - | 默认应用名称或 appid |
| `YUNXIN_CONSOLE_ALLOW_WRITE` | `true` | 设为 `false` 进入只读模式 |
| `YUNXIN_CONSOLE_TIMEOUT_MS` | `15000` | HTTP 超时时间 |
| `YUNXIN_CONSOLE_USER_AGENT` | Chrome UA | 自定义请求 User-Agent |
| `YUNXIN_CONSOLE_LOGIN_TIMEOUT_MS` | `1800000` | 登录等待时间，默认 30 分钟 |

## 验证情况

- 31 个单元/集成测试通过，覆盖 Cookie 会话、HTTP 错误映射、应用解析、IM 配置映射、统计日期和审计日志。
- 已在 DemoApp（appid 10000001）上用**当前值原样调用**以下写接口，均返回 `res:200`，回读配置无变化：
  - `updateInfo`、`updateDeletemsgtime`、`updateRoaming`
  - `msgfriendcheck/set`、`updateChatroomIONoNotify`、`updatePublishOffline`
- `queryAppInfo` 显示该应用 `testAppTag=false`、`envtype=0`，接口层没有“测试环境”标记。

## 已知限制

- 控制台内部 API 可能随前端升级变化；接口集中在 `src/api/`，便于修复。
- 登录态失效后需要重新执行 `login`，目前不会自动刷新。
- 消息抄送写操作、IM 总开关映射、数字人新增等少量接口尚未做真实写测试，已标记为待验证。
- 其他产品（RTC、短信、点播、直播、白板、大模型 API）暂未封装专用工具，可通过 `yunxin_api_call` 调用。

## 开发

```bash
npm install
npm run build
npm test
node dist/cli.js login
node dist/cli.js auth status
```

## License

MIT
