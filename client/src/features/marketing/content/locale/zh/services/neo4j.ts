// Neo4j 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.neo4j walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const NEO4J_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 Neo4j 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 Neo4j 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 Neo4j 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 neo4j 镜像并记录解析出的容器与发现的环境变量（NEO4J_AUTH、NEO4J_PLUGINS）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "理解 Neo4j 转储的工作方式",
      body: "Neo4j 是唯一版本（版次）很重要的引擎。Enterprise 支持 neo4j-admin database backup 的热在线备份，数据库照常服务。Community 的 neo4j-admin database dump 要求数据库停止——安全模式是在最安静时段安排短暂停机，或转储一个从实例。Dockstash 捕获产出的转储工件，绝不是在用的 /data 目录。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。Community 版 Neo4j 请把备份排在最安静时段，让短暂的转储窗口无痛。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 捕获图转储与项目文件并全部送入 restic——实时输出逐行见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "Neo4j 备份只有重新载入可查询的图后才算数。Dockstash 的还原默认绝不覆盖线上数据库——先还原到全新位置、载入测试实例，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都含一致的 neo4j-admin 转储工件，外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "载入并验证还原的图",
        body: "启动一个 Neo4j 测试容器（与生产相同镜像与插件），对已停止的目标用 neo4j-admin database load 载入转储，启动后用几条 Cypher 查询验证——核心标签上的节点数与关系数是最快的测试。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "Community 上转储步骤失败：「database is in use」。",
      cause: "Community 上 neo4j-admin database dump 要求数据库停止；不支持热转储。",
      fix: "把备份排在安静时段做短暂停机，转储从实例，或换 Enterprise 用 neo4j-admin database backup 做热在线备份。",
    },
    {
      symptom: "还原的库能启动，但用到 APOC 或 GDS 的查询失败。",
      cause: "插件属于镜像与配置，不在转储里——还原目标镜像没带它们。",
      fix: "载入转储前，还原到装有相同 NEO4J_PLUGINS（APOC、GDS）的镜像，再重跑失败的过程。",
    },
    {
      symptom: "neo4j-admin database load 拒绝覆盖目标。",
      cause: "load 命令没有显式指示不会替换现有数据库，且目标必须停止。",
      fix: "停止目标数据库并传入 --overwrite-destination=true（文档化还原命令正是如此），然后启动 Neo4j。",
    },
    {
      symptom: "备份远大于图的表面大小。",
      cause: "转储包含完整存储；两次转储之间事务日志的抖动也降低 restic 去重。",
      fix: "保持每日转储排程，让 prune + 保留策略修剪历史；在项目卡片观察体积趋势确认保留在生效。",
    },
  ],
  gotchas: [
    "Community 版上 `neo4j-admin database dump` 要求数据库停止——热转储不受支持，热复制 /data 也不一致。",
    "Enterprise 版支持经 `neo4j-admin database backup` 的热在线备份；Community 需安排短暂停机或转储从实例。",
    "Bolt 端口（7687）是给客户端的；备份经容器内的 neo4j-admin，不走 Bolt。",
  ],
  faq: [
    {
      question: "能不停机备份 Neo4j 吗？",
      answer:
        "Enterprise 能——用 `neo4j-admin database backup` 做热在线备份。Community 的 `database dump` 需要数据库停止，Dockstash 安排短暂停机或转储副本。",
    },
    {
      question: "为什么不复制 /data/databases 目录？",
      answer:
        "图存储与事务日志被持续写入。热拷贝不一致，可能载入不了。neo4j-admin dump/backup 产出一致、可还原的工件。",
    },
    {
      question: "如何还原 Neo4j 转储？",
      answer:
        "对停止的目标用 `neo4j-admin database load ... --overwrite-destination=true`，再启动 Neo4j。Dockstash 在任何覆盖前先载入暂存数据库。",
    },
    {
      question: "备份包含已安装的插件吗？",
      answer:
        "不包含——插件（APOC、GDS）属于镜像/配置，不属于数据库转储。载入前确认目标镜像带同样插件。",
    },
    {
      question: "Neo4j 应该多久备份一次？",
      answer:
        "每日是务实默认——用 Community 且需要短暂停机窗口就选最安静时段。Free 仅手动；Pro 最高每小时，Business 任意 cron。",
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
