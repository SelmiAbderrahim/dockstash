// 平台指南（使用 Dockstash 本身）的中文文案。
// 步骤键与 content/platform-guides.ts 一一对应。事实来自产品文档
// （docs/*.zh.md）。

import type { PlatformGuideCopy } from '../types';

export const PLATFORM: Record<string, PlatformGuideCopy> = {
  'connect-fleet-agent': {
    intro:
      '舰队代理是运行在另一台 VPS 上的小守护进程，让 Dockstash 也能备份那台主机上的容器。代理经 HTTPS 主动回连——你的机器不开任何入站端口——并执行与主服务器相同的「先转储后 restic」流水线。多 VPS 舰队是 Business 档的功能。',
    steps: {
      'open-fleet': {
        title: '打开 Fleet 页面',
        body: '在控制台进入 Fleet。该页面列出每个已注册代理及其在线/离线状态、版本与最近一次心跳。',
      },
      'register-agent': {
        title: '注册代理',
        body: '点击 Register agent，填写名称和它将运行的主机。同一对话框里，把 Project directories 字段设为那台 VPS 上 Compose 项目所在的位置（默认 /var/www）——代理只会在这些目录内发现、备份和还原。',
      },
      'copy-token': {
        title: '复制一次性令牌',
        body: '注册会铸造形如 dsa_<agentId>.<secret> 的令牌并只显示一次——服务器上只存带密钥的 HMAC，永远无法再取回。现在就复制。丢了就在代理行上用 Rotate key：新令牌一铸出，旧令牌立即失效。',
      },
      'install-agent': {
        title: '在 VPS 上安装代理',
        body: '注册对话框展示一段可直接复制粘贴的 docker-compose 配置，已预填你的令牌和项目目录。粘贴到目标 VPS 并启动。内置的 docker-socket-proxy 按最小权限原则给代理 Docker 访问（仅容器 + exec）——它绝不触碰裸 socket。',
      },
      'set-project-roots': {
        title: '检查项目目录的挂载',
        body: '列出的每个目录还必须在 compose 中以读写方式 bind 挂载（容器内外路径一致）——还原要把文件写回去。以后要加目录，打开代理的 Setup 对话框，加入后重新执行显示的 compose 命令。',
      },
      'verify-online': {
        title: '确认代理在线',
        body: '约 30 秒内第一次心跳到达，Fleet 行翻为在线。若仍离线，确认两个容器都在运行，且从 VPS 能访问你的 Dockstash 地址。',
      },
      'assign-project': {
        title: '把项目指派给代理',
        body: '打开某项目的 Plan 标签，把「Runs on」设为新代理（默认是「This server (local)」）。此后该项目的排程与手动备份都由代理认领执行，实时日志流回你的控制台。',
      },
    },
    faq: [
      {
        question: 'Dockstash 服务器会连进我的 VPS 吗？',
        answer:
          '不会。连接只有出站：代理用 Bearer 令牌经 HTTPS 轮询和发心跳。你不开任何入站端口，服务器也从不主动拨号你的机器。',
      },
      {
        question: '代理能看到我服务器上的什么？',
        answer:
          '只有你允许的部分。文件系统访问限于配置的项目目录（且必须显式挂载），Docker 访问经 socket 代理，只暴露容器列表和 exec——没有镜像构建、没有卷挂载、没有主机 root。',
      },
      {
        question: '代理在备份中途挂了会怎样？',
        answer:
          '每个任务都有租约（默认 15 分钟，日志流动时续期）。租约到期任务标记失败并发出警报——绝不静默重试，你总能知道某次运行没有完成。',
      },
      {
        question: '还原演练在舰队代理上运行吗？',
        answer:
          '还不行——演练仍在主服务器上执行。备份、校验（restic check）、prune 和还原都在代理上远程运行。',
      },
      {
        question: '我轮换了密钥，代理开始收 401。怎么办？',
        answer:
          '运行中的容器还握着旧令牌。更新 docker-compose.agent.yml 里的 DOCKSTASH_AGENT_TOKEN 并重建容器。轮换会立即吊销旧令牌——设计如此。',
      },
    ],
  },

  'schedule-backups': {
    intro:
      'Dockstash 为每个项目排程四种任务——backup、prune、check、drill——各有自己的 cron 表达式，经序列化队列执行，保证同一仓库同时只有一个任务。设好每日备份、带保留策略的每周 prune 和每周演练，平台就替你运行并验证备份。',
    steps: {
      'open-schedule': {
        title: '打开项目的 Schedule 标签',
        body: '进入项目详情页，打开 Schedule 标签。排程需要付费档：Free 只能手动备份，Pro 最高每小时，Business 任意 cron 表达式。',
      },
      'pick-frequency': {
        title: '选择备份频率',
        body: '选每日、每周或自定义 cron——语法输入即校验（0 3 * * * = 每天 03:00）。安静时段的每日备份是正确默认；只有丢一天写入不可接受时才用每小时。',
      },
      'add-prune': {
        title: '添加带保留策略的 prune 排程',
        body: 'prune 有意作为独立任务类型——它持有仓库锁并删除数据，因此绝不与备份同跑。加一个每周 prune 并设定保留策略（保留 N 个每日/每周/每月快照）；它直接映射为 restic forget --prune。',
      },
      'add-check-drill': {
        title: '添加完整性校验与还原演练',
        body: '排程一个 check（restic check——结构完整性，便宜，可每日）和一个 drill（完整还原到隔离工作区并做字节与行级比对——昂贵，每周正合适）。演练把「备份存在」变成「备份能还原」。',
      },
      'save-and-watch': {
        title: '保存并观察第一次排程运行',
        body: '保存排程等它触发。每个运行中的任务把 restic 输出实时流入日志面板。同一仓库上撞车的两个排程会自动序列化——并发访问会让 restic 弄坏仓库，队列是正确性契约，不是优化。',
      },
    },
    faq: [
      {
        question: '为什么 prune 不能在备份任务里跑？',
        answer:
          'prune 持有仓库锁且具破坏性。合并任务若半途失败，你可能既没有新备份也没有完成的 prune。分开的排程让每个操作独立成败。',
      },
      {
        question: '两个排程同时触发会怎样？',
        answer:
          '同一仓库：序列化——第二个等第一个。不同仓库并行运行。一个仓库绝不会同时看到两个 restic 操作。',
      },
      {
        question: '我的套餐允许什么 cron 频率？',
        answer:
          'Free 没有排程（只有手动 Backup Now）。Pro 最高每小时。Business 任意 cron 表达式。表单会拒绝超出套餐上限的输入。',
      },
      {
        question: '排程运行失败会重试吗？',
        answer:
          '会，采用带上限的指数退避。反复失败会把排程标为 failed 并发送警报邮件——失败刻意做得响亮。',
      },
      {
        question: '排程备份运行时能观看吗？',
        answer:
          '能。每个任务把 restic 的 stdout/stderr 逐行经实时 socket 流入项目日志面板，与手动 Backup Now 完全相同。',
      },
    ],
  },

  'restore-a-backup': {
    intro:
      'Dockstash 的还原刻意求稳：在 Snapshots 页面选快照，键入项目名确认，默认还原到新位置——覆盖线上项目是独立、显式的选择。还原运行时 restic 输出实时流动。',
    steps: {
      'open-snapshots': {
        title: '打开 Snapshots 页面',
        body: '在 Snapshots 页面选中项目。你会得到还原点时间线——每次成功备份都是一个快照，项目文件、数据库转储和配置一起被捕获。',
      },
      'pick-restore-point': {
        title: '选择还原点',
        body: '在目标快照行点击 Restore。通常选最新的；坏部署或数据损坏后，选事故前的最后一个快照。',
      },
      'typed-confirm': {
        title: '键入项目名确认',
        body: '确认对话框要求输入精确的项目名。这是刻意的摩擦——还原有后果，键入确认杜绝选错项目的事故。',
      },
      'choose-mode': {
        title: '选择还原模式',
        body: '保持默认「Restore to new location」并输入目标路径：快照在那里落地，线上项目原封不动。「Overwrite existing」替换线上项目，是显式选择——只在验证过一次还原数据后再用。',
      },
      'watch-logs': {
        title: '观看还原流',
        body: '文件与转储落地时，restic 输出流入表格下方的日志面板。完成后目标路径包含项目文件和该快照的数据库转储。',
      },
      'validate-result': {
        title: '切换前先验证',
        body: '把还原的转储载入测试数据库容器，抽查应用依赖的表。之后再切换应用或用覆盖模式重来。想持续获得这种证明，就排程还原演练。',
      },
    },
    faq: [
      {
        question: '还原会覆盖我正在运行的项目吗？',
        answer:
          '除非显式选择「Overwrite existing」，否则不会。默认模式还原到你指定的新位置，线上项目保持不动。',
      },
      {
        question: '能只还原一个文件或只还原数据库吗？',
        answer:
          '快照把文件、转储和配置放在一起。还原到新位置，从还原树里取你需要的部分——挑选单件最安全的方式。',
      },
      {
        question: '如何在全新服务器上还原？',
        answer:
          '架起新的 Dockstash，指向同一台存储 VPS，用同一把主加密密钥导入配置导出信封。仓库随即可解密，每个快照都可还原。见文档中的 bootstrap recovery 手册。',
      },
      {
        question: '还原有多快？',
        answer:
          'restic 还原大致以网络和磁盘速度进行；控制台逐行显示实时进度。还原到新位置也意味着应用在还原期间保持在线。',
      },
    ],
  },

  'restore-drills': {
    intro:
      '备份在还原之前都是未经证明的。还原演练把最新快照还原到隔离工作区，逐字节比对每个还原文件，对数据库转储做行级比对，并在项目上盖「通过/失败」徽章——自动、按排程。这是相信备份与确知备份的差别。',
    steps: {
      'schedule-drill': {
        title: '排程每周演练',
        body: '在项目 Schedule 标签添加 drill 排程。每周是推荐节奏：演练是昂贵的证明（真实还原），而便宜的结构校验（restic check）可以每天在旁边跑。',
      },
      'run-drill-now': {
        title: '或者立刻触发一次',
        body: '项目详情页的 Restore drill 标签展示上次结果，也能立即发起演练。演练还原到隔离工作区——线上项目与仓库绝不被触碰。',
      },
      'read-report': {
        title: '阅读演练报告',
        body: '只有差异数为零演练才算通过：每个文件逐字节一致、每个转储行级一致。项目显示 lastDrillAt 和通过/失败徽章——「Verified」意味着真实还原成功了，而不是仅仅存在一个备份。',
      },
      'fix-failures': {
        title: '把失败的演练当作事故',
        body: '演练失败会发出带差异详情的警报邮件。常见原因：绕过适配器的服务产生撕裂转储、备份期间并行部署改动了文件、或仓库损坏（用带数据读取的 check 确认）。修复原因，跑 Backup Now，再演练一次。',
      },
    },
    faq: [
      {
        question: '演练究竟比对什么？',
        answer:
          '每个源路径与配置都与还原镜像做字节哈希比对，每个启用的数据库层的还原转储都与源做行级比对（或解析）。任何差异都判演练失败——没有部分通过。',
      },
      {
        question: '演练会弄坏我的线上项目吗？',
        answer:
          '不会。演练还原到隔离工作区，之后清理干净，哪怕演练抛异常也如此。线上项目、容器与仓库都是只读参与者。',
      },
      {
        question: '演练和 restic check 有何不同？',
        answer:
          'restic check 证明仓库结构健康（没有丢包、没有索引腐坏）。只有演练能证明仓库真能还原成可用数据。check 每日，演练每周。',
      },
      {
        question: '演练在舰队代理上运行吗？',
        answer:
          '还不行——演练在主服务器执行。远程项目的备份、check、prune 和还原仍在其代理上。',
      },
    ],
  },

  'notifications-alerts': {
    intro:
      'Dockstash 让失败大声作响。任何失败的备份、还原或演练都会立刻给项目所有者发警报邮件，一个「死人开关」式心跳还能抓住那种什么都没失败、只因什么都没运行的沉默场景。每条警报都带项目、错误、上次成功时间和直达链接。',
    steps: {
      'understand-triggers': {
        title: '了解什么会触发警报',
        body: '四类：备份失败（任一层——转储、restic、磁盘空间）、还原失败、演练失败（字节或行差异）、以及项目在窗口内没有成功备份时的心跳警报。不需要按失败配规则——失败永远告警。',
      },
      'set-heartbeat': {
        title: '调整心跳窗口',
        body: '心跳阈值（默认 24 小时）是「沉默即失败」的窗口：项目上次成功备份早于该窗口就会收到警报——包括从未成功过的项目。警报在窗口内去重，备份一成功立即重置。',
      },
      'add-webhook': {
        title: '为值班流程加 webhook',
        body: '设置警报 webhook URL，每条警报同时把 JSON 载荷 POST 到那里——接进 Slack、PagerDuty 或你自己的机器人。邮件与 webhook 载荷一致：自动化看到的和你看到的完全一样。',
      },
      'review-audit': {
        title: '使用审计日志',
        body: '破坏性与计费相关操作（备份运行、还原触发、排程删除、套餐变更）追加进不可变审计日志，含操作者、动作、目标、IP 和时间戳——没有修改或删除路径。可在账户里或经审计 API 查看。',
      },
    },
    faq: [
      {
        question: '项目反复失败会不会刷爆我的邮箱？',
        answer:
          '心跳警报在窗口时长内去重后才会再次告警，成功备份立即清除去重。失败警报按失败运行发出——运行接连失败，那是信号，不是垃圾邮件。',
      },
      {
        question: '警报载荷里有什么？',
        answer:
          '项目名、错误详情、上次成功时间戳和项目控制台的直达链接。webhook 收到同样字段的 JSON。',
      },
      {
        question: '什么都没失败，为什么我收到警报？',
        answer:
          '那是心跳：窗口内没有任何成功备份落地。暂停的排程、停掉的代理、从未运行的项目——沉默中长得一模一样；死人开关正是为这些场景存在。',
      },
      {
        question: '外部监控能盯 Dockstash 本身吗？',
        answer:
          '能——把可用性监控指向免认证的健康端点（栈健康 200，降级 503）。聚合计数在不含个人数据的指标端点上。',
      },
    ],
  },

  'retention-policy': {
    intro:
      '保留策略决定留多少历史：每个项目 N 个每日、N 个每周、N 个每月快照。Dockstash 把策略直接映射到由排程 prune 任务执行的 restic forget --prune——旧快照自动修剪，仓库保持紧凑，而近期还原点永不被碰。',
    steps: {
      'open-retention': {
        title: '打开 Settings → Retention',
        body: '保留在 Settings 中集中配置。套餐限定窗口：Free 保 7 天，Pro 30 天，Business 90 天——你设的策略以套餐上限为准。',
      },
      'choose-keep': {
        title: '选择保留数量',
        body: '一个稳妥的默认：保 7 个每日、4 个每周、6 个每月。这给你一周内按天、一个月内按周、半年内按月的还原粒度——同时 restic 去重让仓库保持小巧。',
      },
      'schedule-prune': {
        title: '排程 prune 任务',
        body: '给每个项目加每周 prune 排程。保留数量一比一转成 restic forget 参数——下面的命令正是 7/4/6 策略所执行的。prune 是独立任务类型，因为它锁仓库并删数据；绝不搭备份的车。',
      },
      'verify-prune': {
        title: '确认 prune 生效',
        body: '第一次 prune 完成后看项目卡片：快照数应趋平，仓库大小不再无限增长。Snapshots 时间线精确显示留下了哪些还原点。',
      },
    },
    faq: [
      {
        question: 'prune 会删掉我唯一的新备份吗？',
        answer:
          '不会。保留数量总是保住每一类中最新的快照——prune 剪的是旧尾巴，绝不是新头。7 个每日的策略永远保有最近七个每日快照。',
      },
      {
        question: '降级套餐后保留会怎样？',
        answer:
          '新套餐的保留上限即刻生效，且降级绝不删除现有备份——超额项目被暂停（只读），不会被清除。',
      },
      {
        question: 'prune 之后仓库为什么还是很大？',
        answer:
          'restic forget 删除快照；随后的 --prune 阶段重新打包并释放无引用数据。空间在 prune 完成后才下降，不是 forget 之后——看 prune 任务日志里的重打包摘要。',
      },
      {
        question: '快照不多也需要 prune 吗？',
        answer:
          '终归需要。没有 prune，每个快照永生，仓库无限增长。带合理保留数的每周 prune 是对存储盘写满的廉价保险——盘满本身就是一种备份故障。',
      },
    ],
  },

  'storage-destinations': {
    intro:
      'Dockstash 把备份存在你掌控的机器上：一台经 SSH 访问的存储 VPS，放着加密的 restic 仓库。你的数据与你之间没有第三方云——配置只是一份 SSH 身份加一个加密密码，两者都握在你手里。',
    steps: {
      'prepare-vps': {
        title: '准备一台存储机器',
        body: '任何能 SSH 到的 Linux VPS 或家用服务器都行——只需要磁盘空间和一个 SSH 用户，无需安装任何东西。用一台不同的机器（最好不同供应商或地点）而不是跑项目的那台：备份放同一台机器上会随机器一起消失。',
      },
      'add-ssh-key': {
        title: '添加 SSH 连接',
        body: '在设置向导（或之后的 Settings → Storage）填入主机、用户、端口和 SSH 私钥。私钥只写——保存后不再显示。Dockstash 用这份身份经 SFTP 推送 restic 快照。',
      },
      'save-encryption-password': {
        title: '保存加密密码——只显示一次',
        body: '向导生成一个强仓库加密密码并只显示一次。点 Done 之前把它复制进密码管理器。这不可恢复：丢了就意味着任何人永远无法解密这些仓库。',
      },
      'verify-connection': {
        title: '用第一次备份验证',
        body: '在任意项目上跑 Backup Now。一轮绿色运行证明：存储 VPS 可达、SSH 身份可用、仓库初始化并正确加密。之后项目卡片会显示存储机器上仓库大小在增长。',
      },
      'plan-recovery': {
        title: '为全损恢复做打算',
        body: '把三样东西分开存放：存储 VPS（你的仓库）、主加密密钥、配置导出信封。三样俱全时，生产服务器被毁只是一次重建，不是数据损失——bootstrap recovery 手册一步步带你走。',
      },
    },
    faq: [
      {
        question: '任何供应商都能当存储目的地吗？',
        answer:
          '任何你能 SSH 上去的东西：便宜的存储 VPS、Hetzner 存储盒、异地的 NAS。会说 SSH/SFTP 且有磁盘，restic 就能在那里维护仓库。',
      },
      {
        question: '谁能读到存储机器上的备份？',
        answer:
          '没有你的加密密码谁也不能。restic 在数据离开你的服务器之前就用 AES 加密仓库；存储机器只见密文。',
      },
      {
        question: '加密密码丢了怎么办？',
        answer:
          '仓库无法恢复——这正是真加密的意义。向导显示密码那一刻就存进密码管理器，并把主密钥与导出信封分开备份。',
      },
      {
        question: '能轮换加密密码或 SSH 密钥吗？',
        answer:
          '能。Settings → Encryption password 轮换仓库密码（需勾选「我已保存」的显式确认），Settings → Storage 随时接受新的 SSH 密钥。',
      },
    ],
  },

  'troubleshooting-backups': {
    intro:
      '备份失败时，Dockstash 大声告诉你并指出位置：带错误的警报邮件、项目卡片上的状态徽章、实时日志面板里完整的 restic 输出。本指南走一遍常见故障形态——红色运行、离线代理、沉默警报——和它们的修法。',
    steps: {
      'check-status': {
        title: '从项目卡片开始',
        body: 'Projects 页面按项目显示状态徽章、上次备份时间和大小。失败的运行同时以警报邮件送达，含错误和直达链接——从哪个开始都行。项目详情页直接展示上次失败的详情。',
      },
      'read-live-logs': {
        title: '读这次运行的 restic 输出',
        body: '打开失败运行的日志面板。最后几行几乎总能点名原因：authentication failed（SSH 密钥或数据库凭据）、no space left on device（存储机器满了）、connection refused（存储 VPS 不可达），或容器内转储命令的错误。',
      },
      'stale-lock': {
        title: '陈旧的 restic 锁会自愈',
        body: '运行崩溃或服务器在备份途中重启，仓库可能留在锁定状态。无需干预：下一次运行会检测孤儿锁并自动执行 restic unlock。真正运行中任务持有的锁永远不会被打破。',
      },
      'agent-offline': {
        title: '代理项目：先查代理',
        body: '舰队代理项目停止备份时，看 Fleet 页面。离线意味着心跳停了：到 VPS 上确认代理的两个容器都在跑、Dockstash 地址可达、令牌没有在未更新容器的情况下被轮换。日志里反复的 401 意味着某处还有老容器拿着已吊销的令牌在心跳。',
      },
      'heartbeat-alerts': {
        title: '理解「没有备份运行」的警报',
        body: '心跳警报意味着窗口内没有成功备份落地——什么都没失败，什么都没运行。常见嫌疑人：排程被停用、套餐没有排程、降级后项目被暂停、指派的代理离线。修好原因，下一轮绿色运行就清除警报。',
      },
    },
    faq: [
      {
        question: '备份失败一次、重试成功了。要在意吗？',
        answer:
          '看失败原因。任务用带上限的指数退避重试：瞬时网络抖动自愈。同一错误上的反复重试——磁盘渐满、SSH 不稳——值得在变成硬故障前真正修一修。',
      },
      {
        question: '为什么我的第二个排程在等而不是在跑？',
        answer:
          '一个仓库同时一个任务，永远如此。并发 restic 操作会弄坏仓库，同一仓库上撞车的排程被刻意序列化。不同仓库并行运行。',
      },
      {
        question: '我代理的 Add-Project 选择器是空的。为什么？',
        answer:
          '选择器读取代理上次心跳推送的快照。空意味着：代理还没上报过、某个项目目录并未真正挂进代理容器、或 Docker socket 代理不可达——选择器的横幅会告诉你是哪个。修好后点 Refresh now，不必等下一个发现周期。',
      },
      {
        question: '如何证明仓库本身健康？',
        answer:
          '跑一个 check 任务。restic check 验证仓库结构；给个数据读取百分比还会实际读取并校验 pack 内容。通过要求退出码为零——没有假绿。',
      },
      {
        question: '在哪里看演练为什么失败？',
        answer:
          '演练结果存有含差异数的详情消息，显示在 Restore drill 标签和警报邮件里。字节差异指向备份期间被改动的文件；行差异指向转储一致性——两种情况都把备份当作未证明，直到新一轮通过。',
      },
    ],
  },
};
