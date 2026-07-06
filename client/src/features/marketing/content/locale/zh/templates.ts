// 确定性文案生成器（content/transform.ts）的中文句库。
// 五种开场结构——句库长度必须与其他语言一致，slug 轮换才能保持对齐。
// 槽位插入通用事实；命令与路径永不翻译。

import type { TemplateBank } from '../types';

export const TEMPLATES: TemplateBank = {
  intro: [
    '要在 Docker 中备份 {{name}}，用 `{{cmd}}` 从运行中的容器导出转储，再交给 restic 做加密异地存储。绝不要对 {{livePath}} 直接跑 restic：{{consistency}} 写入途中抓取的实时文件副本是撕裂的，无法还原。',
    '备份 {{name}} 容器的正确方式是逻辑转储，而不是文件复制。在容器内执行 `{{cmd}}` 并备份其输出。在 {{alias}} 写入时复制 {{livePath}} 会得到不一致的快照；{{consistency}}',
    '安全备份 {{name}} 只有一条规则：转储，不要复制。`{{cmd}}` 从运行中的容器产出一致、可还原的转储，restic 再把它加密存到异地。{{consistency}} 任何对 {{livePath}} 的热复制都可能换来无法还原的备份。',
    '{{name}} 在触碰 restic 之前需要一次一致的转储。Dockstash 在容器内执行 `{{cmd}}`，捕获输出并加密存到异地——它绝不热复制 {{livePath}}，因为{{consistencyLower}}',
    '想要一个真正能还原的 {{name}} 备份？用 `{{cmd}}` 在容器内转储，而不是复制 {{livePath}}。{{consistency}} Dockstash 随后把转储交给 restic，得到加密、去重的异地快照。',
  ],
  consistency: {
    postgres:
      'pg_dumpall 读取一致的 MVCC 快照：每个数据库都在同一时刻被捕获，且不阻塞写入。',
    mysql:
      '--single-transaction 把转储包进一个 InnoDB 事务，在同一致点捕获所有表且无写锁。',
    mariadb:
      '--single-transaction 把转储包进一个 InnoDB 事务，在同一致点捕获所有表且无写锁。',
    mongodb:
      '--oplog 记录转储期间的操作，mongorestore --oplogReplay 便能重建时间点一致的快照。',
    redis:
      'SAVE/BGSAVE 会 fork 出某一时刻的 RDB 快照写到磁盘：备份的是完成的 dump.rdb（启用时加上 AOF），而不是易失的内存状态。',
    valkey:
      'SAVE/BGSAVE 会 fork 出某一时刻的 RDB 快照写到磁盘：备份的是完成的 dump.rdb（启用时加上 AOF），而不是易失的内存状态。',
    sqlite:
      'SQLite 的在线备份 API（sqlite3 ".backup" 或 VACUUM INTO）读出尊重 WAL 与进行中事务的一致副本——裸文件复制做不到。',
    clickhouse:
      '原生 BACKUP 语句把表 part 一致地冻结：ClickHouse 在后台合并、变更 part，裸复制会撕裂。',
    elasticsearch:
      '快照 API 捕获每个索引一致、增量的时间点视图，而 Lucene 段在底下继续合并。',
    rabbitmq:
      '导出定义把 broker 的完整拓扑捕获为 JSON——RabbitMQ 的持久部分——而实时的 Mnesia 消息存储在负载下不具时间点一致性。',
    minio:
      'mc mirror 经 S3 API 原子地复制每个对象，保留 /data 裸复制在 multipart 上传进行时可能丢失的元数据。',
    influxdb:
      '备份命令经引擎冻结 TSM 分片与元数据：后台压实绝不会给你留下撕裂的磁盘副本。',
    neo4j:
      'neo4j-admin dump（或 Enterprise 版的在线备份）产出一致的存储快照，因为图存储与事务日志被持续写入。',
  },
};
