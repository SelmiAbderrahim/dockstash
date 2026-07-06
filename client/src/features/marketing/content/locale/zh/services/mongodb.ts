// MongoDB 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.mongodb walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const MONGODB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 MongoDB 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 MongoDB 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 MongoDB 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 mongo 镜像并添加带正确转储命令的数据库层——以及容器名和发现的环境变量（MONGO_INITDB_ROOT_USERNAME、MONGO_INITDB_ROOT_PASSWORD、MONGO_INITDB_DATABASE）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证转储",
      body: "若想先取证，运行同一条转储——mongodump 把单一归档写到 stdout，再接一个字节计数器。大而非零的字节数就是归档顺畅流出的证明。被备份的正是这个归档，绝不是线上的 /data/db 目录。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数 MongoDB 项目，安静时段的每日备份是正确默认值。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在容器内执行带 --archive 和 --oplog 的 mongodump，并把归档直接流入 restic——实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "MongoDB 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上数据库——先还原到全新的暂存位置，在那里回放归档、检查数据，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都是完整的 mongodump 归档——所有数据库与集合，加上转储期间捕获的 oplog 记录——连同同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "在测试容器里用 mongosh 列出数据库，确认每个库都回来了，再抽查应用依赖的集合。文档计数和最近记录是最快的测试。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "转储失败：「--oplog mode only supported on replica set members」（或类似）。",
      cause: "你的 mongod 以 standalone 运行。--oplog 需要可读的 oplog，而只有副本集成员才维护它——standalone 服务器上无可捕获。",
      fix: "转成单节点副本集：以 --replSet rs0 启动 mongod 并执行一次 rs.initiate()。同一容器、同一数据，还得到时间点一致性保证。",
    },
    {
      symptom: "compose 设置了 MONGO_INITDB_ROOT_USERNAME，mongodump 却报「Authentication failed」。",
      cause: "MONGO_INITDB_* 变量只在空的 /data/db 卷首次初始化时创建用户。卷已存在或凭据后来改过，compose 的值就不再反映现实。",
      fix: "用数据库中真实存在的凭据认证（用 mongosh 检查），或重建用户，然后对齐 compose 环境变量。",
    },
    {
      symptom: "mongorestore 到测试容器失败，报版本不支持或归档无效。",
      cause: "归档来自比还原目标更新的服务器或 mongodump——把 mongo:7 的归档还原进 mongo:5 不受支持。",
      fix: "还原到与转储相同的大版本（如 mongo:7），并保持 mongodump/mongorestore 同一 Database Tools 版本。跨版本升级由服务器在还原后完成，而非 mongorestore。",
    },
    {
      symptom: "崩溃或重启后，备份运行因 restic 陈旧锁失败。",
      cause: "上一个任务中途死掉，把仓库锁住了。",
      fix: "无需手动处理：下一次运行会检测到孤儿锁并自动执行 restic unlock 再继续。如果仍持续失败，请在实时日志面板查看底层错误。",
    },
  ],
  gotchas: [
    "绝不要对 /data/db 的线上 WiredTiger 文件跑 restic——检查点中途拷出的文件不一致，常常无法恢复。",
    "--oplog 要求服务器是副本集成员（哪怕单节点副本集）；standalone 的 mongod 上它是无操作，没有时间点保证。",
    "还原时 --oplogReplay 必须搭配 --oplog 转储，否则时间点一致性丢失。",
  ],
  faq: [
    {
      question: "--oplog 到底做什么？",
      answer:
        "它记录 mongodump 运行期间发生的操作日志条目并存入归档。还原时 --oplogReplay 重放它们，让转储反映单一一致时刻，而非跨转储窗口的模糊状态。",
    },
    {
      question: "一致备份需要副本集吗？",
      answer:
        "要时间点一致性就需要——--oplog 只在副本集成员上工作。许多单节点部署正是为此以单成员副本集运行。",
    },
    {
      question: "为什么不直接复制 /data/db？",
      answer:
        "WiredTiger 持续写检查点。检查点中途的文件拷贝捕获的不一致状态往往无法启动。mongodump 读取的是逻辑、可还原的快照。",
    },
    {
      question: "如何还原到干净的数据库？",
      answer:
        "mongorestore --archive --oplogReplay --drop 在还原前删除现有集合，避免新旧数据混杂。Dockstash 默认先还原到暂存目标。",
    },
    {
      question: "MongoDB 应该多久备份一次？",
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
