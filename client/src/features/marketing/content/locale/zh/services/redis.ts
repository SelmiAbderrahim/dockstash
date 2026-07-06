// Redis 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.redis walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const REDIS_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 Redis 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 Redis 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 Redis 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 redis 镜像并添加采用正确「先保存再捕获」策略的数据库层——以及容器名和发现的环境变量（REDIS_PASSWORD、REDIS_ARGS）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证快照",
      body: "若想先取证，触发与 Dockstash 相同的保存：在容器里执行 redis-cli BGSAVE。Redis 回复「Background saving started」，随后 fork 并把某一时刻的 dump.rdb 写进 /data。被备份的正是这个完成的 RDB 文件——绝不是内存中的实时状态。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。Redis 作主存储（队列、会话）时，每日是合理下限，每小时很常见。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 触发后台保存，等待 dump.rdb 完成后备份它——若启用 AOF 持久化则连同 appendonly.aof——直接送入 restic。实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "Redis 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上实例——先还原到全新位置、检查数据，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都含某一时刻的完整 dump.rdb（启用时还有 AOF）以及同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "把还原的 dump.rdb 放进 Redis 测试容器的数据目录并启动——Redis 启动时加载 RDB。执行 redis-cli PING 应得到 PONG，再用 DBSIZE 和几个 GET 抽查应用依赖的键。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "还原的 dump.rdb 加载失败：「Short read or OOM loading DB」或文件截断错误。",
      cause: "RDB 在 Redis 重写它时被复制——重写中途的抓取产生半截文件。",
      fix: "永远先触发 SAVE 或 BGSAVE 并等待完成，再捕获 dump.rdb。Dockstash 正是如此：触发保存、等待完成、备份成品文件。",
    },
    {
      symptom: "还原成功但最近的写入不见了。",
      cause: "启用了 AOF 持久化，appendonly.aof 里的写入比 RDB 快照新——单靠 RDB 会滞后。",
      fix: "两个文件都备份。Dockstash 在同一次运行中同时捕获 /data/dump.rdb 与 appendonly.aof。",
    },
    {
      symptom: "把还原的 dump.rdb 放进 /data，但运行中的 Redis 依旧返回旧数据。",
      cause: "Redis 只在启动时读 RDB——无法热替换。而且若启用 appendonly，Redis 启动时加载 AOF、完全忽略 RDB。",
      fix: "停止容器，把还原的 dump.rdb（以及还原的 AOF）放进数据目录，再启动。若只把 RDB 还原进启用 AOF 的部署，首次启动临时设 appendonly no，之后再启用。",
    },
    {
      symptom: "BGSAVE 失败：「Can't save in background: fork: Cannot allocate memory」。",
      cause: "后台保存所需的 fork 被内核的内存 overcommit 启发式拒绝——主机上的 Redis 数据集较大时会发生。",
      fix: "在 Docker 主机上设 vm.overcommit_memory=1（sysctl）——Redis 启动时自己推荐的设置。fork 用写时复制，并不真需要数据集的第二份完整拷贝。",
    },
  ],
  gotchas: [
    "在 Redis 重写 dump.rdb 时复制它会得到截断文件；先触发 SAVE（或 BGSAVE），再备份完成的 RDB。",
    "若启用 AOF 持久化，也要备份 appendonly.aof 文件——单靠 RDB 可能落后于最新写入。",
    "Redis 还原需要停止或重启服务器以加载 RDB；无法把 dump.rdb 热插进运行中的实例。",
  ],
  faq: [
    {
      question: "Redis 值得备份吗？",
      answer:
        "取决于用途。纯缓存丢了会自动回填。作为主存储（队列、会话、有序集合）就值得——备份 RDB，启用时连同 AOF。",
    },
    {
      question: "SAVE 还是 BGSAVE——Dockstash 用哪个？",
      answer:
        "BGSAVE 在后台 fork 出快照且不阻塞；SAVE 阻塞到完成。Dockstash 偏好后台保存，然后备份写完的 dump.rdb。",
    },
    {
      question: "AOF（append-only file）怎么办？",
      answer:
        "若启用 appendonly，AOF 持有 RDB 可能尚未反映的最新写入。Dockstash 同时捕获 /data/dump.rdb 与 appendonly.aof，不丢最近数据。",
    },
    {
      question: "Redis 运行时能复制 dump.rdb 吗？",
      answer:
        "只能在 SAVE/BGSAVE 完成之后。重写进行中复制可能抓到半截文件。Dockstash 触发保存并等待完成后才捕获。",
    },
    {
      question: "Redis 应该多久备份一次？",
      answer:
        "按内容定排程：队列与会话常用每小时；变化慢的数据每日足够。Free 计划手动备份（Backup Now）；Pro 最高每小时，Business 任意 cron 表达式。",
    },
    {
      question: "备份到底存放在哪里？",
      answer:
        "存放在你自己的存储 VPS 上，是经 SSH 推送的加密 restic 快照。Dockstash 从不把你的数据放在第三方云上——你指向一台由你掌控的机器，仓库用只有你持有的密码加密。",
    },
    {
      question: "如何知道 Redis 备份真的能还原？",
      answer:
        "安排还原演练。Dockstash 把最新快照还原到隔离工作区，逐字节比对文件并校验捕获的转储——然后盖「通过/失败」徽章。每周演练意味着证明永远新鲜。",
    },
  ],
};
