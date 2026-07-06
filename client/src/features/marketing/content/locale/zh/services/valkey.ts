// Valkey 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.valkey walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const VALKEY_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 Valkey 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 Valkey 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 Valkey 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 valkey/valkey 镜像并添加采用「先保存再捕获」策略的层——以及容器名和发现的环境变量（VALKEY_PASSWORD、VALKEY_ARGS 及旧的 REDIS_PASSWORD）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证快照",
      body: "若想先取证，触发同样的保存：在容器里执行 valkey-cli BGSAVE。Valkey 回复「Background saving started」，fork 并把某一时刻的 dump.rdb 写进 /data——与继承自 Redis 的 RDB 持久化完全相同。被备份的是这个成品文件，绝不是内存中的实时状态。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。Valkey 作主存储（队列、会话）时，每日是合理下限，每小时很常见。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 触发后台保存，等待 dump.rdb 完成后备份它——启用 AOF 时连同 appendonly.aof——直接送入 restic。实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "Valkey 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上实例——先还原到全新位置、检查数据，再慎重切换。",
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
        body: "把还原的 dump.rdb 放进 Valkey 测试容器的数据目录并启动——Valkey 启动时加载 RDB。执行 valkey-cli PING 应得到 PONG，再用 DBSIZE 和几个 GET 抽查应用依赖的键。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "还原的 dump.rdb 加载失败：文件截断或 short-read 错误。",
      cause: "RDB 在 Valkey 重写它时被复制——与 Redis 相同的重写中途风险：RDB 持久化模型一模一样。",
      fix: "永远先触发 SAVE 或 BGSAVE 并等待完成，再捕获 dump.rdb。Dockstash 正是如此。",
    },
    {
      symptom: "用 redis-cli 手动测试正常，valkey-cli 却报「not found」（或相反）。",
      cause: "客户端二进制因镜像而异：官方 valkey/valkey 镜像带 valkey-cli，部分兼容镜像软链的是 redis-cli。",
      fix: "用镜像自带的那个——协议与命令相同。Dockstash 自动检测容器内存在的客户端；两种情况下备份都正常。",
    },
    {
      symptom: "把还原的 dump.rdb 放进 /data，但运行中的 Valkey 依旧返回旧数据。",
      cause: "与 Redis 一样，Valkey 只在启动时读 RDB——无法热替换。启用 appendonly 时 AOF 启动优先，RDB 被忽略。",
      fix: "停止容器，把还原的 dump.rdb（以及 AOF）放进数据目录再启动。若只还原了 RDB 进 AOF 部署，首次启动临时设 appendonly no。",
    },
    {
      symptom: "还原成功但最近的写入不见了。",
      cause: "启用了 AOF 持久化，appendonly.aof 的写入比 RDB 快照新。",
      fix: "两个文件都备份。Dockstash 在同一次运行中同时捕获两者。",
    },
  ],
  gotchas: [
    "和 Redis 一样：绝不在重写途中抓取 dump.rdb——先 SAVE/BGSAVE，再备份成品文件。",
    "valkey-cli 是客户端二进制；部分兼容镜像软链了 redis-cli——Dockstash 检测实际存在的那个。",
    "需要最新写入时启用并捕获 AOF；单靠 RDB 可能滞后。",
  ],
  faq: [
    {
      question: "备份 Valkey 与 Redis 有何不同？",
      answer:
        "没有实质差别。Valkey 从 Redis 分叉，保留了相同的 RDB 与 AOF 持久化模型。唯一实际区别是客户端二进制名（valkey-cli），Dockstash 自动检测。",
    },
    {
      question: "能把 Redis 的 RDB 还原进 Valkey 吗？",
      answer:
        "当前版本可以——RDB 格式在分叉点后仍共享。随着两个项目分化，稳妥起见还原时保持同一引擎。",
    },
    {
      question: "Dockstash 会自动识别 Valkey 吗？",
      answer:
        "会。valkey/valkey 镜像和 valkey-cli 二进制都能识别，VALKEY_PASSWORD 和旧的 REDIS_PASSWORD 都会被拾取。",
    },
    {
      question: "也要捕获 AOF 吗？",
      answer:
        "若启用 appendonly 且丢不起最后几秒写入，是的。Dockstash 同时备份 RDB 和 AOF 文件。",
    },
    {
      question: "Valkey 应该多久备份一次？",
      answer:
        "按内容定排程：队列与会话常用每小时；变化慢的数据每日足够。Free 计划手动备份（Backup Now）；Pro 最高每小时，Business 任意 cron。",
    },
    {
      question: "备份到底存放在哪里？",
      answer:
        "存放在你自己的存储 VPS 上，是经 SSH 推送的加密 restic 快照。Dockstash 从不把你的数据放在第三方云上——你指向一台由你掌控的机器，仓库用只有你持有的密码加密。",
    },
    {
      question: "如何知道 Valkey 备份真的能还原？",
      answer:
        "安排还原演练。Dockstash 把最新快照还原到隔离工作区，逐字节比对文件并校验转储——然后盖「通过/失败」徽章。",
    },
  ],
};
