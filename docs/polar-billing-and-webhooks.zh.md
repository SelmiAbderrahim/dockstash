# Polar 计费与 Webhook

Dockstash 以 Polar 作为活动支付提供方，运行在提供方无关的接口之后。Stripe
适配器仍保留在代码中，但默认处于停用状态。

## 端点

- `POST /api/billing/checkout`（需鉴权）— 启动托管结算会话。
- `GET  /api/billing/portal`（需鉴权）— 打开托管客户门户。
- `POST /api/billing/change-plan`（需鉴权）— 切换当前订阅的产品。
- `POST /api/billing/webhook` — Polar 推送。先验证再解析。

## Webhook 地址

在 Polar 控制台配置 `https://<你的服务器>/api/billing/webhook`。

## Standard Webhooks 签名

Dockstash 按 [Standard Webhooks](https://standardwebhooks.com) 方案校验每次推送：

- `signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"`
- `signature      = base64(HMAC-SHA256(secret, signed_content))`
- 请求头：`webhook-signature: v1,<sig> [v1,<sig> ...]`
- 时间戳超出 ±5 分钟将被拒绝。

校验运行在原始字节上；签名通过前绝不会对 body 进行 `JSON.parse`。

## 幂等性

每次推送以 `(provider, eventId)` 唯一约束 INSERT 到 `webhook_event` 集合。
重复推送直接返回 `200` 与已保存的状态——不会重复分发。若处理器失败，
该行状态置为 `failed`，`retryCount` 递增；Polar 将按退避策略重试。

## 对账（Reconciliation）

`reconcileSubscriptions()` 每 15 分钟运行一次。它查询 Polar 的活动订阅并修复
本地 `Subscription` 行的漂移（状态、`currentPeriodEnd`、`cancelAtPeriodEnd`）。
它绝不会创建 Polar 未报告的行，单条记录失败也不会中止循环。

## 环境变量

| 变量 | 用途 |
|---|---|
| `PAYMENT_PROVIDER` | `none` / `polar` / `stripe`。默认 `none`。 |
| `POLAR_ACCESS_TOKEN` | 仅服务器。以 `MASTER_ENCRYPTION_KEY` 静态加密。 |
| `POLAR_WEBHOOK_SECRET` | Standard Webhooks 密钥。接受 `whsec_…`。 |
| `POLAR_SERVER` | `sandbox`（默认）或 `production`。 |
| `POLAR_PRO_PRODUCT_ID` | 产品 id → `pro` 计划。 |
| `POLAR_BUSINESS_PRODUCT_ID` | 产品 id → `business` 计划。 |
