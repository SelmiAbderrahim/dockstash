# 告警、审计与健康

Dockstash 让失败可见。任何备份、恢复或演练失败都会通过 Resend 立即向项目所有者
发送邮件。Dead-man's-switch heartbeat 捕捉静默停滞——没有报错但也没有运行的
情况。

## 触发告警的场景

| 类型 | 场景 |
|---|---|
| `backup` | 备份运行失败。 |
| `restore` | 恢复失败。 |
| `drill` | 计划恢复演练失败。 |
| `heartbeat` | 过去 `ALERT_HEARTBEAT_HOURS` 小时内没有成功备份。 |

每封邮件包含项目名、错误、最近一次成功时间和仪表板链接。若配置
`ALERT_WEBHOOK_URL`，同样的 JSON 会 POST 到该地址。

## Heartbeat 窗口

`ALERT_HEARTBEAT_HOURS`（默认 `24`）设定静默停滞阈值。若最近一次成功早于该
窗口，扫描将告警一次，并在同一窗口内去重。

## 审计日志

破坏性或计费性操作追加到不可变日志：`backup.run`、`backup.restore`、
`backup.delete`、`plan.change`。每条记录记录行为者、动作、目标、来源 IP 与时间。

获取：`GET /api/audit`（限所有者，需鉴权）。

## 健康与指标端点

- `GET /api/health` — 就绪探测（200/503）。
- `GET /api/metrics` — 聚合计数器。
- `GET /api/health/projects` — 每项目，限所有者。

## 环境变量

| 变量 | 用途 |
|---|---|
| `RESEND_API_KEY` | Resend API 密钥。 |
| `RESEND_FROM` | 发件人地址。 |
| `ALERT_HEARTBEAT_HOURS` | 静默停滞阈值。 |
| `ALERT_WEBHOOK_URL` | 可选 webhook。 |
