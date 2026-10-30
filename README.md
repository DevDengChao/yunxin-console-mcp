# yunxin-console-mcp

MCP server for the NetEase Yunxin admin console (`app.yunxin.163.com`).

The official [yunxin-mcp-server](https://github.com/netease-im/yunxin-mcp-server) exposes
server-side IM/RTC APIs. This project fills the gap by exposing **console administration**
capabilities: application management, AppKey/AppSecret, callbacks, certificates, push
configuration, IM feature flags, test accounts, sensitive words and statistics.

> This project uses the console's internal `frontApi`. It is unofficial and may break when
> NetEase changes the console. Use at your own risk.

## Status

Early development. See the tool list in the README once the first version is published.

## Requirements

- Node.js 20+
- Google Chrome or Microsoft Edge installed (used for the one-time login)

## Install

```bash
npm install -g yunxin-console-mcp
# or run from source
npm install
npm run build
```

## First login

The console session is cookie-based. Run the login command once:

```bash
yunxin-console-mcp login
```

A dedicated Chrome window opens. Log in with your Yunxin account; the session is saved to
your user config directory and reused by the MCP server. The browser can be closed after
the command reports success.

Alternative: provide a cookie header manually.

```bash
yunxin-console-mcp auth import --cookie "name=value; name2=value2"
```

## MCP client configuration

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

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `YUNXIN_CONSOLE_HOME` | OS config dir | Session and audit data directory |
| `YUNXIN_CONSOLE_COOKIE` | - | Cookie header, overrides the saved session |
| `YUNXIN_CONSOLE_DEFAULT_APP` | - | Default app name or appid |
| `YUNXIN_CONSOLE_ALLOW_WRITE` | `true` | Set to `false` for read-only mode |
| `YUNXIN_CONSOLE_TIMEOUT_MS` | `15000` | HTTP timeout |

## License

MIT
