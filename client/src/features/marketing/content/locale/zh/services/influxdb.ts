// InfluxDB 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.influxdb walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const INFLUXDB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 InfluxDB 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 InfluxDB 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 InfluxDB 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 influxdb 镜像及其大版本，并添加带正确备份命令的层——v2 用 influx backup，v1 用 influxd backup -portable——以及容器名和发现的环境变量（DOCKER_INFLUXDB_INIT_USERNAME、DOCKER_INFLUXDB_INIT_PASSWORD、DOCKER_INFLUXDB_INIT_ORG）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证备份命令",
      body: "若想先取证，在容器里把 influx backup 跑到一个临时路径。你会看到它经 HTTP API 为每个桶拍快照并写出分片与元数据文件——被备份的正是这个由引擎协调的快照，绝不是在用的 TSM 目录。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。时序数据积累很快：每日是正确默认——业务关键指标可每小时。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在容器内执行版本正确的备份命令——v2 经 HTTP API 的 influx backup，v1 的 influxd backup -portable——并把快照直接送入 restic。实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "InfluxDB 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上时序数据——先还原到全新位置、检查桶，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都是 TSM 分片与元数据在引擎级别的一致快照——桶、保留策略与用户——外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "用 influx restore（v1 用 influxd restore -portable）把备份载入 InfluxDB 测试容器并列出桶。每个期望的桶都应携带保留策略出现；对最近时间范围跑个快速查询，确认最新数据点在内。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "备份命令失败：「unknown command」或无法识别的参数。",
      cause: "v1 与 v2 命令行完全不同：v2 用 influx backup 走 HTTP API，v1 用 influxd backup -portable。用一代的命令打另一代立即失败——升级镜像 tag 之后很常见。",
      fix: "查容器大版本（influxd version）再用匹配命令。Dockstash 依镜像识别大版本并自动选对；升级后在 Plan 标签重跑检测。",
    },
    {
      symptom: "influx backup 报「unauthorized」或 API 401。",
      cause: "v2 备份走 HTTP API，需要 operator（all-access）令牌。普通只读令牌——或开了认证却没有令牌——都不够。",
      fix: "提供有桶读取权的 operator 令牌。用过 DOCKER_INFLUXDB_INIT_* 变量的话，初始化的管理员令牌可用；否则用 influx auth create --all-access 创建并加入计划凭据。",
    },
    {
      symptom: "复制 /var/lib/influxdb2 得到的备份启动不了，或查询返回残缺数据。",
      cause: "InfluxDB 在后台压实 TSM 分片。在用目录的裸拷贝抓到压实途中的分片——一部分是之前的、一部分是之后的——产出撕裂、不一致的存储。",
      fix: "绝不复制在用数据目录。用引擎的备份命令，它把分片与元数据一致地快照下来——Dockstash 执行的正是它。撕裂的裸拷贝通常救不回来；从真正的备份还原。",
    },
  ],
  gotchas: [
    "绝不要对在用 TSM/WAL 目录跑 restic——分片在后台压实，裸拷贝不一致。",
    "InfluxDB v2 用 `influx backup`（HTTP API + 令牌）；v1 用 `influxd backup -portable`。Dockstash 识别大版本。",
    "v2 备份需要有读取权的 operator 令牌；没有它调用不被授权。",
  ],
  faq: [
    {
      question: "哪条命令能正确备份 InfluxDB？",
      answer:
        "v2：经 HTTP API 带 operator 令牌的 `influx backup`。v1：`influxd backup -portable`。两者都一致地快照 TSM 分片与元数据。Dockstash 识别版本并运行正确的那条。",
    },
    {
      question: "能直接复制分片文件吗？",
      answer:
        "不能。InfluxDB 在后台压实 TSM 分片：在用目录的拷贝不一致。用备份命令，它经引擎协调出一致快照。",
    },
    {
      question: "v2 备份需要什么令牌？",
      answer:
        "对桶有读取权限的 operator（all-access）令牌。Dockstash 检测初始化令牌的环境变量；启用认证时请提供令牌。",
    },
    {
      question: "如何还原时序备份？",
      answer:
        "对全新实例使用 `influx restore`（v2）或 `influxd restore -portable`（v1）。Dockstash 在任何覆盖前先还原到暂存实例。",
    },
    {
      question: "InfluxDB 应该多久备份一次？",
      answer:
        "每日适合多数指标负载；丢一小时数据点都心疼就每小时。Free 手动 Backup Now；Pro 最高每小时，Business 任意 cron。搭配每周演练。",
    },
    {
      question: "备份会阻塞 InfluxDB 写入吗？",
      answer:
        "不会。备份命令经引擎快照分片，服务器持续接受写入——采集器和仪表盘在备份期间照常运转。",
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
