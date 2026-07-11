# 方案与限制

Dockstash 提供三个方案。**Free** 是开源 / 自托管的默认方案，即使未配置支付提供方
也能使用；**Pro** 与 **Business** 需要有效订阅。

## 矩阵

| 功能               | Free       | Pro         | Business       |
|--------------------|------------|-------------|----------------|
| 项目数             | 1          | 10          | 无限            |
| 保留               | 7 天       | 30 天       | 90 天           |
| 计划频率           | 仅每天     | 最高每小时  | 任意 cron       |
| 定时备份           | —          | ✔           | ✔              |
| 邮件提醒           | —          | ✔           | ✔              |
| 已连接服务器       | 1          | 5           | 无限           |

年付 = **月付 × 10**（两个月免费）。价格保存在 `PricingTier` 记录，可无需
重新部署直接编辑。

## 生命周期

- **催缴 / 宽限期。** `past_due` 支付启动 **14 天** 宽限期，期间保留付费权限。
- **过期 = 只读。** 备份**永不删除**，超出上限的项目会被 `paused`。
- **降级超过上限。** 账户进入 `selection-required` 状态，由用户选择保留哪个项目。
- **退款。** 订阅被撤销，回落到 Free。
- **防止重复试用。** 每个邮箱仅一次试用。

## Merchant of Record

Polar 是 **Merchant of Record**：增值税、销售税与开票由 Polar 负责，Dockstash 不
内置税务引擎。

## 邀请赠送

超级管理员可以创建一次性邀请链接（**超级管理员 → 邀请**），赠送 `pro` 或
`business` 套餐，时长为 **1 个月**或 **1 年**。收件人打开 `/invite/<token>`，登录
（或注册）后激活。

- **前缀语义。** 领取时写入一行 `Subscription`，其 `providerSubscriptionId` 为
  `invite-grant-<invitationId>`。该前缀是唯一的区分标志：权益解析器、每夜清扫、
  webhook 覆盖以及 reconcile 排除都以它为准。Polar 行仍保持纯状态语义。
- **失效。** 一旦越过 `currentPeriodEnd`，赠送立即停止授予权益 —— 在读取时强制执
  行，而非依赖清扫。每夜任务（`billing.invite-grant-expiry`，03:30）随后将该行置
  为 `canceled`，并通过 `applyProjectCap` 让用户回落到 `free`：超出上限的项目会被
  **暂停，绝不删除**。
- **购买覆盖赠送。** Polar 订阅激活时，该用户所有生效中的赠送先被取消。已持有有效
  付费套餐的用户无法领取链接（`invitations.error.alreadySubscribed`）。
- **reconcile 从不触碰赠送行** —— 它们在 Polar 没有对应记录。
- **撤销**是软撤销（`revokedAt`），仅对未领取的链接生效。
