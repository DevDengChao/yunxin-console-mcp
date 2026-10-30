# 发布流程

本项目使用 **npm Trusted Publisher + GitHub Actions OIDC** 发布，不需要在 GitHub
仓库中保存长期 `NPM_TOKEN`。

## 首次配置

1. 打开 npm 包设置页：

   https://www.npmjs.com/package/@devdengchao/yunxin-console-mcp/settings

2. 找到 **Trusted Publisher**，选择 **GitHub Actions**。

3. 填写：

   | 字段 | 值 |
   | --- | --- |
   | Organization or user | `DevDengChao` |
   | Repository | `yunxin-console-mcp` |
   | Workflow filename | `publish.yml` |
   | Environment | 留空 |

4. 保存。

配置完成后，`.github/workflows/publish.yml` 会在推送 `v*` tag 时通过 OIDC
自动发布，并生成 npm provenance。

## 发布新版本

```bash
npm version patch   # 或 minor / major
git push --follow-tags
```

`publish.yml` 会：

1. 执行 `npm ci`、`typecheck`、`test`
2. 检查该版本是否已存在于 npm
3. 不存在时执行 `npm publish --provenance --access public`

如果版本已经发布，workflow 会跳过 publish，不会报错。

## 手动发布

如果 CI 不可用，也可以在本地发布（需要 npm 2FA）：

```bash
npm login --registry=https://registry.npmjs.org
npm publish --access public
```

## 常见问题

- **OIDC 发布失败**：确认 npm 包的 Trusted Publisher 配置中的仓库名和 workflow
  文件名与实际一致。
- **版本已存在**：先执行 `npm version patch` 提升版本号，再推送 tag。
- **不想使用 OIDC**：也可以在仓库中配置 `NPM_TOKEN` secret，但需要自行承担
  token 轮换和泄露风险。
