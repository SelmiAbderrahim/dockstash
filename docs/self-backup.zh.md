# 自备份

编排器将**自身**的 Mongo 备份到专用的 restic 仓库。Compose 默认使用持久化的
`self-backup-data` 卷。

## 捕获的内容

- `Project` 文档（路径、计划、加密的仓库密码）。
- `Schedule` 文档（cron、保留策略、种类）。
- 加密密钥（存储 SSH 密钥、restic 仓库密码）——以密文形式，
  从不明文。
- 备份 / 校验 / 演练历史行。

编排器将 `mongodump --archive` 直接流式送入
`restic backup --stdin`——从不写临时文件。

## 保留仓库

自备份写入 `SELF_BACKUP_REPO`（Compose 默认值：`/self-backup`）。
该卷在容器重建后仍会保留，但仍位于同一主机；如需异地保护，请配置远程
restic URL 及其凭据。

## 调度

节奏为 `SELF_BACKUP_CRON`（默认每晚 `0 3 * * *`），与其他 cron 任务一起
注册。启动时的重新注册是幂等的——cron 条目就地替换，从不堆叠。

## 失败语义

每次运行持久化一行 `SelfBackupRun`：写入时 `running` → `success`，或如
果任一层失败 `running` → `failed`。没有部分 `success`。如果 `mongodump`
失败，`restic backup` 永不被调用。如果 `restic backup` 失败，归档流会被
销毁。失败连同错误消息存储在该行上。
