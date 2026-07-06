// PostgreSQL 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.postgres walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const POSTGRES_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 PostgreSQL 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 PostgreSQL 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 PostgreSQL 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 postgres 镜像并添加带有正确转储命令的数据库层——以及解析出的容器名和发现的环境变量（POSTGRES_USER、POSTGRES_PASSWORD、POSTGRES_DB）。保存前可以开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证转储",
      body: "若想在自动化前先取证，运行 Dockstash 将执行的同一条转储命令。你会看到 SQL 语句流出——被备份的正是这段输出，绝不是线上的数据目录。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在项目的 Schedule 标签选择每日、每周或自定义 cron 表达式（输入即校验）。对多数 PostgreSQL 项目，安静时段的每日备份是正确默认值。再加一个每周 prune 排程配合保留策略，自动修剪旧快照。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击项目卡片上的 Backup Now。Dockstash 在运行中的容器内执行 pg_dumpall，并把转储直接流入 restic——你可以在日志面板逐行观看 restic 实时输出。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "PostgreSQL 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上数据库——先还原到全新位置、检查数据，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览还原点时间线。每一行都是整个集群所有数据库的完整一致转储，外加同一次运行捕获的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "用 psql 把还原的转储加载进一个 PostgreSQL 测试容器，列出数据库并抽查应用依赖的表。行数统计和最近记录是最快的真伪测试。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "转储失败，报「role does not exist」或认证错误。",
      cause: "compose 里的 POSTGRES_USER 已不对应数据库中的真实角色——手动改名角色或从其他项目还原卷之后很常见。",
      fix: "在容器里运行 psql，用 \\du 查看真实角色，然后把 compose 环境变量（或计划里的转储凭据）对齐到现存的超级用户角色。",
    },
    {
      symptom: "还原的 SQL 报「extension ... is not available」。",
      cause: "转储引用了 CREATE EXTENSION（PostGIS、pgvector 等），但还原目标镜像不带这些扩展二进制。",
      fix: "还原到与生产服务相同的镜像（如 postgis/postgis 或含 pgvector 的构建），而不是原味 postgres 镜像。",
    },
    {
      symptom: "备份突然变得很慢，或仓库快速膨胀。",
      cause: "大表频繁写入时 pg_dumpall 的输出整体变化，降低了 restic 去重率。",
      fix: "保持每日排程，让 prune + 保留策略修剪历史；超大集群请通过项目卡片的仓库体积趋势确认保留策略确实在清理。",
    },
    {
      symptom: "崩溃或重启后，备份运行因 restic 陈旧锁失败。",
      cause: "上一个任务中途死掉，把仓库锁住了。",
      fix: "无需手动处理：下一次运行会检测到孤儿锁并自动执行 restic unlock 再继续。如果仍持续失败，请在实时日志面板查看底层错误。",
    },
  ],
  gotchas: [
    "绝不要对线上 /var/lib/postgresql/data 目录跑 restic——写入途中拷出的堆页面是撕裂的，无法还原。",
    "pg_dumpall 捕获角色和所有数据库；单独的 pg_dump 会漏掉角色、表空间等全局对象。",
    "扩展（PostGIS、pgvector）必须在还原前装进目标镜像，否则 SQL 会报错。",
  ],
  faq: [
    {
      question: "为什么用 pg_dumpall 而不是复制数据目录？",
      answer:
        "运行中的 Postgres 数据目录被持续写入。复制它会得到撕裂、不一致、无法启动的状态。pg_dumpall 从运行中的服务器读取一致的 MVCC 快照，产出能干净还原的转储。",
    },
    {
      question: "备份期间 Dockstash 会锁库吗？",
      answer:
        "不会。pg_dumpall 使用 MVCC 快照：读取一致且不阻塞写入。转储期间应用继续正常服务。",
    },
    {
      question: "PostgreSQL 应该多久备份一次？",
      answer:
        "每日是大多数项目的务实默认值；若丢失一天的写入不可接受则每小时。Free 计划只能手动备份；Pro 允许最高每小时的排程，Business 允许任意 cron。把排程与每周还原演练搭配使用。",
    },
    {
      question: "如何只还原一个数据库？",
      answer:
        "pg_dumpall 归档是纯 SQL；可用 psql 还原整个集群，或按库使用 pg_dump/pg_restore。Dockstash 默认还原完整一致快照。",
    },
    {
      question: "PostGIS、pgvector 等扩展怎么办？",
      answer:
        "转储只引用 CREATE EXTENSION，不携带二进制。请确保还原目标镜像具备相同扩展。",
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
