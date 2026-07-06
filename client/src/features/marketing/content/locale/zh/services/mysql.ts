// MySQL 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.mysql walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const MYSQL_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 MySQL 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 MySQL 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 MySQL 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 mysql 镜像并添加带正确转储命令的数据库层——以及容器名和发现的环境变量（MYSQL_ROOT_PASSWORD、MYSQL_DATABASE、MYSQL_USER、MYSQL_PASSWORD）。保存前可以开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证转储",
      body: "若想先取证，运行同一条转储命令。你会看到 SQL 流出——CREATE DATABASE、CREATE TABLE、INSERT。被备份的正是这段输出，绝不是线上的 /var/lib/mysql 目录。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数 MySQL 项目，安静时段的每日备份是正确默认值。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在容器内执行带 --single-transaction、--routines、--triggers 的 mysqldump，并把转储直接流入 restic——实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "MySQL 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上数据库——先还原到全新位置、检查数据，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都是服务器上所有数据库同一时刻的完整转储——模式、数据、存储过程与触发器——外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "把转储载入 MySQL 测试容器，执行 SHOW DATABASES 确认每个模式都回来了，再抽查应用依赖的表。行数和最近记录是最快的测试。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "转储失败：「Access denied for user 'root'@'localhost'」。",
      cause: "compose 里的 MYSQL_ROOT_PASSWORD 与数据卷内的真实密码不再一致——该变量只在首次初始化时设置密码，之后改 compose 对已有卷无效。",
      fix: "使用卷初始化时的密码，或在容器内重置 root 密码，然后对齐 compose 环境变量。",
    },
    {
      symptom: "转储完成，但还原后部分表不一致。",
      cause: "那些表是 MyISAM。--single-transaction 只对事务型 InnoDB 表保证一致快照；MyISAM 表在保证之外。",
      fix: "用 SHOW TABLE STATUS 查引擎。把 MyISAM 迁到 InnoDB（ALTER TABLE ... ENGINE=InnoDB）是治本之道，或接受 --lock-tables 的短暂锁。",
    },
    {
      symptom: "还原到测试容器报「Unknown collation: utf8mb4_0900_ai_ci」。",
      cause: "转储来自 MySQL 8.x，却还原进 5.7 镜像；8.0 的默认排序规则在旧服务器中不存在。",
      fix: "还原到与转储相同的大版本（如 mysql:8）。旧转储入新服务器可行；反之常失败。",
    },
    {
      symptom: "崩溃或重启后，备份运行因 restic 陈旧锁失败。",
      cause: "上一个任务中途死掉，把仓库锁住了。",
      fix: "无需手动处理：下一次运行会检测到孤儿锁并自动执行 restic unlock 再继续。如果仍持续失败，请在实时日志面板查看底层错误。",
    },
  ],
  gotchas: [
    "绝不要对线上 /var/lib/mysql 目录跑 restic——写入途中拷出的 InnoDB 表空间不一致，恢复会失败。",
    "--single-transaction 只对事务型（InnoDB）表给出一致快照；MyISAM 不在其内，需要加锁。",
    "要加 --routines 和 --triggers，否则存储过程和触发器会悄悄从转储中消失。",
  ],
  faq: [
    {
      question: "--single-transaction 为什么重要？",
      answer:
        "没有它，mysqldump 逐表读取，两表之间的写入会产生不一致转储。--single-transaction 把一切包进一个 InnoDB 事务：整个转储反映同一时刻，且无写锁。",
    },
    {
      question: "转储包含存储过程和触发器吗？",
      answer:
        "只有传入 --routines 和 --triggers 才包含，Dockstash 已带上。默认的 mysqldump 会省略它们——这是「还原了但坏了」的常见原因。",
    },
    {
      question: "能通过复制 /var/lib/mysql 备份 MySQL 吗？",
      answer:
        "不能。InnoDB 表空间和 redo 日志持续写入；写入途中的文件拷贝不一致。Dockstash 改为在容器内执行 mysqldump。",
    },
    {
      question: "如果我用 MyISAM 表怎么办？",
      answer:
        "--single-transaction 无法让 MyISAM 一致，因为该引擎非事务型。依赖 MyISAM 就需要短暂加锁（--lock-tables）——把表迁到 InnoDB 才是长久之计。",
    },
    {
      question: "MySQL 应该多久备份一次？",
      answer:
        "每日是大多数项目的务实默认值；若丢失一天的写入不可接受则每小时。Free 计划只能手动备份；Pro 允许最高每小时的排程，Business 允许任意 cron。把排程与每周还原演练搭配使用。",
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
