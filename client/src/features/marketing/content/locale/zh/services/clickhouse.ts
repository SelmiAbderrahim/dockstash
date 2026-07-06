// ClickHouse 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.clickhouse walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const CLICKHOUSE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 ClickHouse 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 ClickHouse 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 ClickHouse 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 clickhouse/clickhouse-server 镜像并添加带正确备份命令的层——以及容器名和发现的环境变量（CLICKHOUSE_USER、CLICKHOUSE_PASSWORD、CLICKHOUSE_DB）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证服务器",
      body: "若想先取证，在容器里用 clickhouse-client 执行 SHOW DATABASES。你会看到数据库列表（default、system 以及应用创建的）——原生 BACKUP DATABASE 语句将把它们捕获为一致的表 part。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数分析型负载，安静时段的每日备份是正确默认值——ClickHouse 数据通常成批到达，每小时意义不大。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在容器内执行原生 BACKUP DATABASE 语句，生成表 part 的一致快照，并把结果交给 restic——实时输出见日志面板。大型 MergeTree 表的首轮可能较久；后续运行会对其去重。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "ClickHouse 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上数据库——先还原到全新位置、检查数据，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都是 ClickHouse 数据库的一致 BACKUP——冻结的表 part，而非撕裂的文件拷贝——外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "在 ClickHouse 测试容器执行 RESTORE DATABASE，然后查询它：SELECT count() FROM system.tables 证明表都回来了；对最大的 MergeTree 表做 count() 与生产对比是最快的测试。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "BACKUP DATABASE 失败，报未知或缺失磁盘。",
      cause: "原生 BACKUP 语句写入命名的备份磁盘，而服务器配置里没有声明。",
      fix: "在 ClickHouse 配置的 <storage_configuration> 下加 backups 磁盘（或 <backups> 允许磁盘条目）并重启，或改用 clickhouse-backup 工具——它通过硬链接冻结 part，无需配置磁盘。",
    },
    {
      symptom: "裸拷贝的 /var/lib/clickhouse 还原后服务器报 part 损坏或缺失。",
      cause: "ClickHouse 在后台持续合并、变更表 part；合并进行时的文件拷贝会抓到改写途中的目录。",
      fix: "绝不复制在用数据目录。用 BACKUP DATABASE 或 clickhouse-backup——两者都先冻结一致的 part 集——再让 Dockstash 把产物交给 restic。",
    },
    {
      symptom: "第一次备份巨大且远超预期时间。",
      cause: "大型 MergeTree 表的初始 BACKUP 要把每个 part 物化一次；不存在更小的起点。",
      fix: "让第一轮跑完——restic 去重加 BACKUP 的增量模式会让后续每轮都很小。在日志面板看进度，在项目卡片看仓库体积趋势。",
    },
  ],
  gotchas: [
    "绝不要对在用的 /var/lib/clickhouse/store 目录跑 restic——part 在后台被合并与变更，裸拷贝不一致。",
    "BACKUP/RESTORE SQL 需要服务器配置了备份磁盘；没有就用 clickhouse-backup 工具，它用硬链接冻结 part。",
    "大型 MergeTree 表产生大备份；restic 增量去重有帮助，但初始 BACKUP 可能不小。",
  ],
  faq: [
    {
      question: "备份 ClickHouse 的正确方式是什么？",
      answer:
        "用原生 BACKUP 语句（BACKUP DATABASE ... TO Disk(...)）或 clickhouse-backup 工具。两者都产出表 part 的一致快照。Dockstash 随后把生成的目录交给 restic。",
    },
    {
      question: "能改成复制 /var/lib/clickhouse 吗？",
      answer:
        "不能。ClickHouse 在后台持续合并、变更 part：在用目录的拷贝不一致。BACKUP 语句或 clickhouse-backup 会安全地冻结 part。",
    },
    {
      question: "BACKUP 语句还是 clickhouse-backup——选哪个？",
      answer:
        "配置了备份磁盘时原生 BACKUP 最简单。clickhouse-backup 擅长用硬链接冻结 part 并运走，特别是旧版本。Dockstash 两种产物都接受。",
    },
    {
      question: "ClickHouse 备份是增量的吗？",
      answer:
        "BACKUP 语句支持基于基线的增量备份，restic 再叠加自己的去重：重复快照保持紧凑。",
    },
    {
      question: "ClickHouse 应该多久备份一次？",
      answer:
        "每日是务实默认——分析数据成批到达，restic 去重让每日快照很便宜。Free 手动备份（Backup Now）；Pro 解锁最高每小时，Business 任意 cron。",
    },
    {
      question: "备份到底存放在哪里？",
      answer:
        "存放在你自己的存储 VPS 上，是经 SSH 推送的加密 restic 快照。Dockstash 从不把你的数据放在第三方云上——你指向一台由你掌控的机器，仓库用只有你持有的密码加密。",
    },
    {
      question: "不做手动还原，如何知道备份可还原？",
      answer:
        "安排一次还原演练。Dockstash 会把最新快照还原到隔离的工作区，逐字节比对每个文件，并校验还原出的转储——然后在项目上盖「通过/失败」徽章。每周演练意味着证明永远新鲜。",
    },
  ],
};
