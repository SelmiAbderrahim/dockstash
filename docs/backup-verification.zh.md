# 备份验证

备份在成功恢复之前都是未被证实的。Dockstash 用两种方式证明：

## `restic check` — 结构完整性

对仓库运行 `restic check`。检测缺失的 pack 文件、损坏的索引条目和 blob 引用
漂移。传入 `readDataSubset`（百分比 1–100）时，Dockstash 附加
`--read-data-subset=<pct>%` 以让 restic 真正读取 pack 内容。

- `POST /api/backups/:id/check` 按需触发。
- 由队列层通过 `runScheduledChecks` 调度。
- 持久化 `lastCheckAt`、`lastCheckStatus` (`pass` / `fail`) 及本地化的
  `lastCheckDetail`。
- `pass` 要求退出码为零 — 任何非零退出即 `fail`，绝不是虚假绿色。

## 恢复演练 — 真正的保证

`restic check` 证明仓库*结构良好*，只有恢复才能证明它*可恢复*。
`runRestoreDrill`：

1. 读取最新快照。
2. 将其恢复到隔离的临时工作区。
3. 逐字节哈希每个源路径并与恢复镜像对比。
4. 对每个数据库层做行 diff（或解析）恢复的转储与源。
5. 汇总不匹配数。`pass` 仅当为零。
6. 持久化 `lastDrillAt`、`lastDrillStatus` 与 `lastDrillDetail`。
7. 在 `finally` 中清理临时空间。

## 频率

- 结构检查：便宜；每次备份后 + 每天。
- 恢复演练：昂贵；每个项目至少每周一次。
