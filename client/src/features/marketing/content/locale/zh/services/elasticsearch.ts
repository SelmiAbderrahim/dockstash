// Elasticsearch 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.elasticsearch walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const ELASTICSEARCH_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 Elasticsearch 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 Elasticsearch 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 Elasticsearch 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 elasticsearch 镜像并添加基于快照 API 的层——以及容器名和发现的环境变量（ELASTIC_PASSWORD、ELASTICSEARCH_USERNAME、discovery.type）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证集群",
      body: "若想先取证，在容器里 curl _cluster/health 端点。green 或 yellow 表示可以做快照（单节点 yellow 正常——副本分片无处安放）。red 表示至少一个主分片不可用；先修好再备份。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照存放在你的存储 VPS 上（SSH）。向导完成后即已配置；可在 Settings → Storage 修改。Elasticsearch 本身还需要一个已注册的快照仓库——文件系统路径（bind 挂载目录最简单）或对象存储——快照 API 写入它，Dockstash 再把它交给 restic 送到异地。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数搜索集群每日是正确默认——仓库内的快照是增量的，每轮只存新段。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 通过快照 API（PUT _snapshot/<repo>/<snap>）触发快照：Elasticsearch 把每个索引的一致时间点视图写入仓库，Dockstash 再把该目录交给 restic 送往你的存储 VPS——实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "Elasticsearch 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上集群——先还原到全新位置、检查索引，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都含快照仓库——每个索引的一致时间点视图——外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原数据",
        body: "对测试节点 curl _cat/indices?v 并读表：每个期望的索引都应是 green 或 yellow 健康、open 状态、docs.count 与生产一致。再用搜索请求抽查几篇文档。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "快照调用失败：repository_missing_exception 或仓库校验错误。",
      cause: "没有注册快照仓库，或路径不在 path.repo / 容器内不可写。",
      fix: "把目录 bind 挂载进容器，加进 elasticsearch.yml 的 path.repo，重启，然后用 PUT _snapshot/<repo> 注册为 fs 仓库。快照只对已注册、校验通过的仓库工作。",
    },
    {
      symptom: "还原被拒：「cannot restore index ... because an open index with same name already exists」。",
      cause: "快照 API 拒绝还原到当前打开的索引——它绝不悄悄合并或覆盖线上数据。",
      fix: "先关闭或删除现有索引，或用 rename_pattern/rename_replacement 换名还原。还原到测试节点可完全避开冲突。",
    },
    {
      symptom: "集群健康为 red，快照要么 partial 要么直接失败。",
      cause: "至少一个主分片未分配；快照无法捕获不可用的分片。",
      fix: "用 _cluster/allocation/explain 诊断并救回主分片（磁盘水位、节点宕机、分片损坏）再备份。单节点 yellow 没问题；red 不行。",
    },
  ],
  gotchas: [
    "绝不要对在用数据目录跑 restic——Lucene 段被持续写入与合并，文件拷贝不一致。",
    "第一次快照前必须注册快照仓库（共享 fs 路径或对象存储）；与容器共享的 bind 挂载路径是最简单的 fs 仓库。",
    "还原已存在的索引需要先关闭或删除它，否则还原被拒。",
  ],
  faq: [
    {
      question: "为什么用快照 API 而不是复制数据文件夹？",
      answer:
        "Elasticsearch 不停写入并合并 Lucene 段：在用目录的拷贝不一致，可能打不开。快照 API 捕获每个索引一致、增量的时间点视图。",
    },
    {
      question: "如何注册快照仓库？",
      answer:
        "配置一个 Elasticsearch 和 Dockstash 都能读的文件系统仓库（或对象存储），再用 PUT _snapshot 调用注册。Dockstash 把该仓库目录交给 restic。",
    },
    {
      question: "Elasticsearch 快照是增量的吗？",
      answer:
        "是。同一仓库内每个快照只存尚未存在的段，重复快照很便宜。restic 去重再叠加效果。",
    },
    {
      question: "对 OpenSearch 也适用吗？",
      answer:
        "适用——OpenSearch 从 Elasticsearch 分叉，保留同样的快照 API 模型。同样注册仓库、同样拍快照。",
    },
    {
      question: "Elasticsearch 应该多久备份一次？",
      answer:
        "每日是务实默认——快照在仓库内增量，即使索引很大每日运行也便宜。Free 手动备份（Backup Now）；Pro 最高每小时，Business 任意 cron。",
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
