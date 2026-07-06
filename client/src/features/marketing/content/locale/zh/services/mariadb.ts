// MariaDB 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.mariadb walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const MARIADB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 MariaDB 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 MariaDB 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 MariaDB 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 mariadb 镜像并添加带正确转储命令的数据库层——以及容器名和发现的环境变量（MARIADB_ROOT_PASSWORD 或旧的 MYSQL_ROOT_PASSWORD，另有 MARIADB_DATABASE、MARIADB_USER）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证转储",
      body: "若想先取证，运行同一条转储——带 --single-transaction 的 mariadb-dump。你会看到 SQL 流出：CREATE DATABASE、CREATE TABLE、INSERT。被备份的正是这段输出，绝不是线上的 /var/lib/mysql。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数 MariaDB 项目，安静时段的每日备份是正确默认值。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在容器内执行带 --single-transaction、--routines、--triggers 的 mariadb-dump，并把转储直接流入 restic——实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "MariaDB 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上数据库——先还原到全新位置、检查数据，再慎重切换。",
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
        body: "把转储载入 MariaDB 测试容器，通过 mariadb 客户端执行 SHOW DATABASES 确认每个模式都回来了，再抽查应用依赖的表。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "手动转储报「mariadb-dump: command not found」。",
      cause: "较旧的 MariaDB 镜像（10.4 及更早）只带 mysqldump；mariadb-dump 出现较晚，新镜像里 mysqldump 保留为兼容软链接。",
      fix: "旧镜像上用相同参数的 mysqldump——输出一致。Dockstash 会检测镜像自带哪个二进制并自动调用正确的那个。",
    },
    {
      symptom: "转储失败：「Access denied for user 'root'@'localhost'」。",
      cause: "compose 的 root 密码键（MARIADB_ROOT_PASSWORD 或旧的 MYSQL_ROOT_PASSWORD）与卷内真实密码不再一致——变量只在首次初始化时生效。",
      fix: "使用卷初始化时的密码，或在容器内重置 root 密码，然后对齐 compose 环境变量。",
    },
    {
      symptom: "把转储还原进 MySQL 容器时报语法错误。",
      cause: "MariaDB 与 MySQL 已分化——MariaDB 的序列、部分排序规则和存储选项在 MySQL 中不存在，跨引擎还原可能翻车。",
      fix: "还原到与转储同一大版本的 MariaDB 镜像。MariaDB → MySQL 的迁移只应在清理转储后有意为之。",
    },
    {
      symptom: "崩溃或重启后，备份运行因 restic 陈旧锁失败。",
      cause: "上一个任务中途死掉，把仓库锁住了。",
      fix: "无需手动处理：下一次运行会检测到孤儿锁并自动执行 restic unlock 再继续。如果仍持续失败，请在实时日志面板查看底层错误。",
    },
  ],
  gotchas: [
    "绝不要对线上 /var/lib/mysql 目录跑 restic——写入途中的 InnoDB 拷贝无法还原。",
    "新镜像带 mariadb-dump；旧镜像用 mysqldump。Dockstash 检测镜像提供的二进制。",
    "MariaDB 接受 MARIADB_ROOT_PASSWORD 或旧键 MYSQL_ROOT_PASSWORD——两者都会被识别。",
  ],
  faq: [
    {
      question: "MariaDB 的备份方式与 MySQL 相同吗？",
      answer:
        "几乎相同。两者都用 --single-transaction 获得一致的 InnoDB 快照。区别在客户端二进制：新的 MariaDB 镜像带 mariadb-dump（mysqldump 是兼容链接）。Dockstash 会选对。",
    },
    {
      question: "Dockstash 识别哪个 root 密码键？",
      answer:
        "MARIADB_ROOT_PASSWORD 和旧的 MYSQL_ROOT_PASSWORD 都识别——MariaDB 镜像因版本而异都接受。",
    },
    {
      question: "能把 MariaDB 转储还原进 MySQL 或反过来吗？",
      answer:
        "常常可以，但不总是——两者的功能与语法漂移会弄坏边缘情况。要可靠就还原进与转储相同的引擎家族。",
    },
    {
      question: "为什么不直接给卷做快照？",
      answer:
        "/var/lib/mysql 卷持续被写入。写入途中的快照不一致。经 mariadb-dump 的逻辑转储才是可还原之路。",
    },
    {
      question: "MariaDB 应该多久备份一次？",
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
