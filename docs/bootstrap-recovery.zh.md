# 引导恢复

本手册涵盖"生产 VPS 已消失"的场景。假设仅有三样东西幸存：

1. **存储 VPS**（restic 仓库完好）。
2. **`MASTER_ENCRYPTION_KEY`**（带外备份）。
3. 已保存的**配置导出信封**（`dockstash-export-*.json`）。

三者缺一，仓库不可恢复——没有主密钥，导出信封是惰性的；没有存储仓库指向，
主密钥毫无用处。

## 1. 搭建新代理

准备一台干净的生产 VPS。克隆仓库、填写 `.env` 并启动堆栈：

```bash
docker compose up -d
```

`api`、`web`、`mongo`、`redis` 与 `docker-socket-proxy` 服务在空 Mongo 上
启动。目前看不到任何项目。

## 2. 提供相同的 `MASTER_ENCRYPTION_KEY`

用与旧代理**逐字节相同**的密钥填充 `./secrets/master_encryption_key`。
**不要**生成新密钥——导出信封中的每个密文都绑定于该密钥。

## 3. 导入导出信封

以与旧所有者相同身份的任意用户登录，然后将已保存的信封 POST 到
`/api/recovery/import`：

```bash
curl -X POST http://localhost:8080/api/recovery/import \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d @dockstash-export-2026-07-01.json
```

导入会验证信封形状（`.strict()` zod），拒绝任何看起来像明文密钥的字段，并
用主密钥解密每个密文。被篡改的信封，或者本代理无法解密其 `keyVersion` 的
信封，会被以 `HTTP 400` 拒绝。

## 4. 确认存储可达

导入后，`restic snapshots` 用解密的密码针对每个项目仓库运行。绿色响应确认：

- 存储 VPS 可达。
- 密码在当前 `MASTER_ENCRYPTION_KEY` 下可解密。
- 仓库未损坏。

## 5. 恢复

从仪表板或调度器触发恢复演练。快照会恢复到临时工作空间，并按字节/行与预期
元数据比对。

## 三样东西不变量

**丢失主密钥或恢复码会使导出信封变为惰性。** 信封仅承载 AES-256-GCM
密文。它可以安全地异地存储，正因为落入错误之手的副本没有密钥毫无用处。

将 `MASTER_ENCRYPTION_KEY` 与恢复码分开存放在不同介质、不同物理位置，且
绝不与信封放在同一备份中。
