# 计划与实时日志

Dockstash 按计划运行 backup / prune / check / drill 任务 — 通过序列化的队列，
**保证同一个仓库同时只运行一个任务**。

## 计划类型

| 类型 | 作用 |
|---|---|
| `backup` | 流式传输数据库转储 + 备份路径/配置。 |
| `prune` | 按保留策略运行 `restic forget --prune`。 |
| `check` | `restic check` — 仓库结构完整性。 |
| `drill` | 恢复最新快照并对比。 |

## 每个仓库一次一个任务

同一仓库上并发触发的两个计划会被序列化。不同仓库并行运行。Prune 是独立类型 —
从不与 backup 内联。

## 保留 → `forget`

```
keepDaily/keepWeekly/keepMonthly → --keep-daily/--keep-weekly/--keep-monthly
```

## 实时日志

每个任务通过 Socket.IO 的 `/scheduler` 命名空间流式输出 restic 的
stdout/stderr。用 JWT 加入任务房间 — 只能加入自己的任务。

## 恢复

崩溃后，下一次重试会检测孤立的锁并安全地调用 `restic unlock`。
