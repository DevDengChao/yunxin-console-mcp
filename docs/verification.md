# 验证记录

日期：2026-10-30

测试账号：13800000000（示例科技有限公司）

测试应用：DemoApp / appid 10000001 / IM 2024 高级版 / 服务区域 SG

## 只读接口

通过 MCP Server（stdio）实际调用，全部成功：

| 工具 | 结果 |
| --- | --- |
| `yunxin_auth_status` | 登录成功，返回账号和企业信息 |
| `yunxin_apps_list` | 3 个应用：DemoApp、DemoApp-Test、DemoApp-Prod |
| `yunxin_app_get` | 返回应用信息、产品配置、IM 配置 |
| `yunxin_im_config_get` | IM 总开关 `true`，撤回 120s，漫游关闭，区域 SG |
| `yunxin_im_user` | 测试账号列表返回 `total: 0` |
| `yunxin_stats_users` | 昨日新增 0、活跃 4、累计 19 |
| `yunxin_stats_im` | 单聊消息统计返回 7 个数据点 |
| `yunxin_app_admin settings` | 返回产品开通状态和余额 |
| `yunxin_app_cert list` | 返回空证书列表 |
| `yunxin_app_ip_whitelist list` | 返回空白名单 |
| `yunxin_stats_users province` | 返回 232 个地区，中国活跃 4 |
| `yunxin_stats_users city` | 返回 200，城市列表为空（当前活跃用户少） |
| `yunxin_app_identity get` | 返回 iOS/Android/HarmonyOS 标识配置 |
| `yunxin_app_callback get` | 返回回调地址、超时、失败策略和事件开关 |
| `yunxin_app_custom_push list` | 返回空列表 |
| `yunxin_app_third_push get` | 返回空列表 |
| `yunxin_im_robot list` | 返回 `total: 0` |
| `yunxin_im_digital_human list` | 返回空列表 |
| `yunxin_im_storage_cleanup list` | 返回 `total: 0` |
| `yunxin_app_admin change_records` | 返回 104 条变更记录 |
| `yunxin_app_admin msg_copy` | 返回抄送配置 |
| `yunxin_app_admin function_matrix` | 返回功能矩阵 |

## 控制台侧已知问题

以下错误在控制台页面本身也会出现，不是 MCP 映射问题：

- `yunxin_im_lexicon list`：`/frontApi/app/cantispam/keyword/query` 返回「参数错误」，后台敏感词页面同样显示「暂无数据 参数错误」。
- `yunxin_im_antispam config`：应用未开通 IM 安全通，接口返回「请先开通IM安全通服务」。
- `yunxin_stats_users city`：`province=中国` 时返回空列表，可能是当前活跃用户太少，没有城市维度数据。

统计接口的日期参数按 **Asia/Shanghai** 解释，与后台页面一致；默认范围是「昨天往前 7 天」。

## 写接口（as-is 无副作用）

以下写接口均使用当前值原样调用，返回 `res: 200`，回读配置完全一致：

| 工具/字段 | 接口 | 回读 |
| --- | --- | --- |
| `yunxin_im_config_update.deletemsgtime` | `/frontApi/app/updateDeletemsgtime` | 120 → 120 |
| `yunxin_im_config_update.roaming` | `/frontApi/app/updateRoaming` | false → false |
| `yunxin_im_config_update.sendMsgCheckFriend` | `/frontApi/app/msgfriendcheck/set` | false → false |
| `yunxin_im_config_update.chatroomIONoNotify` | `/frontApi/app/updateChatroomIONoNotify` | true → true |
| `yunxin_im_config_update.publishoffline` | `/frontApi/app/updatePublishOffline` | false → false |
| `yunxin_app_admin update` | `/frontApi/app/updateInfo` | 名称/行业/简介不变 |

## 环境标记

`queryAppInfo` 返回：

- `testAppTag: false`
- `envtype: 0`

接口层没有“测试环境”标记。上述写测试只使用可回滚的当前值，没有修改实际业务配置。

## 复跑方式

```bash
npm run build
npm run smoke
```
