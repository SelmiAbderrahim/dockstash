// SQLite 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.sqlite walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const SQLITE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加内嵌 SQLite 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 自动发现每个 Compose 项目目录（默认在 /var/www 下）。选择把数据存在 SQLite 文件里的那个项目——PocketBase、Vaultwarden、Uptime Kuma、Gitea、Ghost 都是。此时还没有任何备份。",
    },
    'review-detection': {
      title: "确认 SQLite 已被识别",
      body: "打开项目查看 Plan 标签页。SQLite 没有独立容器——它活在应用镜像里——所以 Dockstash 通过指向数据库文件的环境变量（DATABASE_PATH、DATABASE_URL、DB_PATH）找到它，并添加一个用在线备份 API 捕获快照的数据库层。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证备份",
      body: "若想先取证，运行同一条命令：在应用容器里执行 sqlite3 /data/app.db \".backup '/tmp/app-backup.db'\"。成功时无输出，并在 /tmp/app-backup.db 留下完整一致的副本——含 WAL 内容。被备份的是这个副本，绝不是线上的 .db 文件。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数基于 SQLite 的应用，安静时段的每日备份是正确默认值。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在应用容器里执行 .backup 命令得到数据库的一致副本，再把它连同项目文件送入 restic。实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "SQLite 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上数据库——先还原到全新位置、检查数据，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都含数据库的一致单文件副本——经在线备份 API 生成，因此没有 -wal、-shm 侧文件要对账——外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "执行 sqlite3 <还原文件> \"PRAGMA integrity_check;\"——健康的数据库回答一个「ok」。再用 sqlite3 打开文件抽查应用依赖的表：行数与最近记录是最快的测试。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "数据验证通过后：停止应用，用还原副本替换其数据库文件，再启动（或改用「Overwrite existing」重新还原——需显式确认）。更好的做法：让每周演练自动完成这一验证。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "还原的数据库能打开，但最近的行不见了。",
      cause: "备份是在应用以 WAL 模式运行时仅对 .db 文件的裸拷贝——最新写入还躺在 -wal 侧文件里，从未进入副本。",
      fix: "绝不裸拷贝在用的 WAL 数据库。用 sqlite3 \".backup\" 或 VACUUM INTO——它们走在线备份 API，把 WAL 折叠进副本。Dockstash 正是为此使用备份 API。",
    },
    {
      symptom: ".backup 命令失败：「database is locked」。",
      cause: "长写事务（或卡死的写入者）持有数据库锁，sqlite3 在锁释放前放弃。",
      fix: "设置 busy timeout（sqlite3 -cmd \".timeout 30000\" 或 PRAGMA busy_timeout）让备份等待而非失败，并把备份排在安静时段。若锁始终不释放，找找容器里卡死的写进程。",
    },
    {
      symptom: "对拷贝文件跑 PRAGMA integrity_check 得到「database disk image is malformed」。",
      cause: "文件在应用写入时被复制——撕裂的页面捕获，任何修复工具都无法可靠治好。",
      fix: "丢弃撕裂副本，从备份 API 产出的快照还原。Dockstash 的每个快照都用 \".backup\" 拍摄：integrity_check 应回答「ok」——验证步骤查的正是这个。",
    },
    {
      symptom: "裸拷贝前执行了 PRAGMA wal_checkpoint(TRUNCATE)，副本依然不一致。",
      cause: "检查点在某一刻把 WAL 页折进主文件，但写入者可在其结束后立即追加新的 WAL 帧——并发写入下「检查点再 cp」不是原子快照。",
      fix: "把「检查点加拷贝」当作误区而非技巧。唯一安全的在线快照是备份 API（\".backup\" 或 VACUUM INTO）；裸拷贝只有在应用停止时才安全。",
    },
  ],
  gotchas: [
    "应用以 WAL 模式运行时绝不复制在用的 .db 文件——会丢掉 -wal/-shm 侧文件，得到撕裂、无法还原的数据库。",
    "使用 sqlite3 \".backup\" 或「VACUUM INTO」——两者都走在线备份 API，正确处理 WAL。",
    "裸拷贝前的检查点（PRAGMA wal_checkpoint(TRUNCATE)）在并发写入下不能替代备份 API。",
  ],
  faq: [
    {
      question: "不能直接复制 .db 文件吗？",
      answer:
        "应用写入期间不安全。WAL 模式下最新数据在 -wal 侧文件里；只 cp 一个 .db 会得到陈旧、撕裂的状态。用 sqlite3 \".backup\" 或「VACUUM INTO」，它们经在线备份 API 读出一致副本。",
    },
    {
      question: "VACUUM INTO 是什么？",
      answer:
        "VACUUM INTO 'file.db' 把数据库写成一个全新、碎片整理过、事务一致的副本文件。这是在不停应用的情况下快照在用 SQLite 数据库的干净方式。",
    },
    {
      question: "需要备份 -wal 和 -shm 文件吗？",
      answer:
        "走备份 API 就不用——它把 WAL 并进副本。坚持裸拷贝（在线不建议）就必须包含 -wal 和 -shm，而且依然有竞态风险。",
    },
    {
      question: "如何还原 SQLite 备份？",
      answer:
        "停止应用，用 .backup 的产物替换数据库文件，再启动应用。备份是单个一致文件：没有侧文件要对账。",
    },
    {
      question: "我的应用内嵌 SQLite（PocketBase、Vaultwarden、Uptime Kuma）——Dockstash 能找到吗？",
      answer:
        "能。没有独立的 SQLite 容器可认：Dockstash 读取应用的 compose 配置和环境变量（DATABASE_PATH、DATABASE_URL、DB_PATH）定位文件，再用备份 API 拍快照。首次运行前在 Plan 标签确认检测到的路径。",
    },
    {
      question: "SQLite 应该多久备份一次？",
      answer:
        "每日是多数单文件应用的务实默认值；丢不起一天写入就每小时。Free 计划手动备份（Backup Now）；Pro 最高每小时，Business 任意 cron。",
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
