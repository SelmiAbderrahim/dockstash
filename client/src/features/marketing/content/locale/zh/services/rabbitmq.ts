// RabbitMQ 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.rabbitmq walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const RABBITMQ_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 RabbitMQ 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 RabbitMQ 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 RabbitMQ 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 rabbitmq 镜像并添加导出 broker 定义的层——以及容器名和发现的环境变量（RABBITMQ_DEFAULT_USER、RABBITMQ_DEFAULT_PASS、RABBITMQ_DEFAULT_VHOST）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证导出",
      body: "若想先取证，在容器里执行 rabbitmqctl export_definitions。它写出一个描述整个 broker 拓扑的 JSON——vhost、交换机、队列、绑定、用户与策略。打开它：你会认出应用声明的每一个队列；被备份的正是这个 JSON。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数 broker 每日绰绰有余——拓扑在部署时变化，而非每分钟。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在运行中的容器里执行 rabbitmqctl export_definitions，把 JSON 连同项目文件交给 restic——实时输出见日志面板。broker 服务流量时定义也能干净导出；什么都不停、什么都不锁。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "RabbitMQ 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上 broker——先还原到全新位置、验证拓扑，再慎重切换。记住你还原的是什么：定义 JSON 重建拓扑，而不是当时躺在队列里的消息。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都含导出的定义 JSON——那一刻完整的 broker 拓扑——外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原拓扑",
        body: "在测试 broker 上执行 rabbitmqctl list_queues：它打印每个队列名及消息数。应用声明的每个队列都应出现（计数为零——消息不在备份内）。交换机、绑定、用户、策略同样验证，或走 management 界面。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "还原「成功」了，但所有队列都是空的。",
      cause: "定义与消息是两码事。export_definitions 捕获拓扑——vhost、交换机、队列、绑定、用户、策略——从不包含备份时刻在队列中的消息体。",
      fix: "这是预期行为。把在队消息当作瞬态：生产者可重发、消费者容忍重放。必须在 broker 损失后幸存的消息应持久化到数据库，而非队列。",
    },
    {
      symptom: "用复制的 /var/lib/rabbitmq/mnesia 目录启动的 broker 崩溃或拒绝启动。",
      cause: "broker 运行时 Mnesia 被持续写入：热拷贝内部不一致——存储还绑定节点名，换了 hostname 的主机上会坏。",
      fix: "别把 Mnesia 当备份复制。导出定义并导入到全新 broker；这才是受支持、可还原的路径。",
    },
    {
      symptom: "对运行中的 broker 执行 import_definitions 报错，或留下新旧拓扑混杂。",
      cause: "导入是与现状合并——冲突的队列参数、已存在的用户或策略与 JSON 条目相撞，而不是被替换。",
      fix: "尽量导入全新 broker。必须导入运行中的：预期合并而非重置——先删除冲突实体，再用 rabbitmqctl list_queues 和 management 界面核对结果。",
    },
  ],
  gotchas: [
    "通过 export_definitions 备份 broker 定义（拓扑）——这是 RabbitMQ 中持久、可还原的部分。",
    "Mnesia 消息存储承载在途消息，不能安全地热拷贝；把持久化消息当作瞬态，依靠生产者/消费者恢复。",
    "还原定义重建的是拓扑，而不是备份时刻队列中的消息。",
  ],
  faq: [
    {
      question: "RabbitMQ 应该备份哪部分？",
      answer:
        "定义：vhost、交换机、队列、绑定、用户与策略。把它们导出为 JSON 就捕获了整个 broker 拓扑——损失后重建真正需要的东西。",
    },
    {
      question: "能备份躺在队列里的消息吗?",
      answer:
        "broker 运行时不可靠。Mnesia 存储在负载下不具时间点一致性，消息本就该是瞬态。设计容忍重放的消费者，别指望消息备份。",
    },
    {
      question: "如何还原 RabbitMQ broker？",
      answer:
        "起一个全新 broker，用导出的 JSON 执行 rabbitmqctl import_definitions。完整拓扑——交换机、队列、绑定、用户、策略——全部重建。",
    },
    {
      question: "复制 /var/lib/rabbitmq/mnesia 算有效备份吗?",
      answer:
        "不算。Mnesia 持续写入，热拷贝不一致。改为导出定义；那才是受支持、可还原的备份路径。",
    },
    {
      question: "RabbitMQ 应该多久备份一次？",
      answer:
        "每日绰绰有余——定义只在部署新队列、用户或策略时变化。Free 手动备份（Backup Now）；Pro 最高每小时，Business 任意 cron。",
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
