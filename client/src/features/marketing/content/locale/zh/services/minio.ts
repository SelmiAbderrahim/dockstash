// MinIO 指南的中文文案。步骤键与
// content/guides.ts → SERVICE_GUIDES.minio walkthrough/restoreVerify 一一对应。

import type { ServiceGuideCopy } from '../../types';

export const MINIO_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "创建 Dockstash 账号并打开控制台",
      body: "在 dockstash.com/register 免费注册。一次性设置向导会询问你的存储 VPS（存放加密备份的机器）并生成一个加密密码——请立即把它保存到密码管理器，它只显示一次。",
    },
    'add-project': {
      title: "添加运行 MinIO 的 Docker 项目",
      body: "在 Projects 页面，Dockstash 会自动发现服务器上的每个 Compose 项目目录（默认在 /var/www 下）。选择包含 MinIO 服务的项目。此时还没有任何备份——你只是告诉 Dockstash 项目在哪里。",
    },
    'review-detection': {
      title: "确认 MinIO 已被识别",
      body: "打开项目查看 Plan 标签页。Dockstash 读取 docker-compose.yml，识别 minio/minio 镜像并添加围绕 mc mirror 构建的对象存储层——以及容器名和发现的环境变量（MINIO_ROOT_USER、MINIO_ROOT_PASSWORD，或旧的 MINIO_ACCESS_KEY / MINIO_SECRET_KEY）。保存前可开关文件、数据库和代理配置。",
    },
    'test-dump': {
      title: "可选：手动验证桶列表",
      body: "若想先取证，在容器里对 local 别名执行 mc ls。你会看到每个桶及其大小与对象数——mc mirror 将经 S3 API 逐个对象把这些桶复制出来，绝不是 /data 裸目录。",
    },
    'choose-destination': {
      title: "确认存储目的地",
      body: "备份以加密的 restic 快照形式，经 SSH 存放在你自己的存储 VPS 上。如果你完成了设置向导，这里已经配置好；主机、用户、端口或 SSH 密钥随时可在 Settings → Storage 修改。",
    },
    'schedule': {
      title: "设置备份排程",
      body: "在 Schedule 标签选择每日、每周或自定义 cron（输入即校验）。对多数对象存储，安静时段的每日备份是正确默认——镜像是增量的，后续只复制变化。再加每周 prune 排程配合保留策略。",
    },
    'run-first-backup': {
      title: "立即运行第一次备份",
      body: "点击 Backup Now。Dockstash 在容器里执行 mc mirror，经 S3 API 把每个桶复制出来——每个对象连同元数据原子捕获——并把结果送入 restic。实时输出见日志面板。",
    },
    'confirm-snapshot': {
      title: "确认快照已生成",
      body: "运行结束后，项目卡片会显示新的最近备份时间、快照数量和仓库大小。打开 Snapshots 页面，还原点会出现在时间线上——这就是备份已抵达异地的证明。",
    },
  },
  restoreVerify: {
    intro:
      "MinIO 备份只有在成功还原后才算数。Dockstash 的还原默认绝不覆盖线上桶——先还原到全新位置、检查对象，再慎重切换。",
    steps: {
      'pick-snapshot': {
        title: "选择还原点",
        body: "打开 Snapshots，选中项目，浏览时间线。每一行都是 API 级别的完整桶镜像——每个对象连同元数据与标签——外加同一次运行的项目文件。",
      },
      'restore-scratch': {
        title: "还原到新位置",
        body: "点击 Restore 并保持默认的「Restore to new location」模式。输入项目名称确认——这是一次需要键入确认的慎重操作。转储和文件会落到你选择的目标路径，线上项目不受影响。",
      },
      'verify-data': {
        title: "验证还原对象",
        body: "把还原的桶镜像进一个 MinIO 测试实例，用 mc ls 列出内容。对比对象数与总大小和线上桶，再抽查应用真正提供的几个对象——能正常打开的下载就是最快的测试。",
      },
      'promote': {
        title: "确认无误后再切换",
        body: "还原数据验证通过后，把应用指向它（或改用「Overwrite existing」重新还原——需要显式确认）。更好的做法：让每周的还原演练自动完成这一验证，让真正的还原永远不是你的第一次排练。",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "还原出的 /data 目录副本不提供对象，或 MinIO 启动时记录 xl.meta 错误。",
      cause: "备份是裸拷贝 /data 而非经 S3 API 镜像。MinIO 把每个对象与 xl.meta 元数据文件放在一起；裸拷贝丢失或撕裂它们会让对象不可读。",
      fix: "用 mc mirror 走 S3 API 备份——Dockstash 默认就这样配置。继承了裸拷贝备份的话，把它还原进同版本、已停止的 MinIO，用 mc ls 核对每个桶后再信任。",
    },
    {
      symptom: "一些最近上传的对象没进备份。",
      cause: "镜像运行时它们是进行中的 multipart 上传——最后一片落地前 S3 列表看不见未完成上传，裸拷贝则会把它们抓成废片。",
      fix: "没有损坏：下一次排程镜像会带上完成的对象。某次上传很重要就在它完成后重跑 Backup Now，或把备份排在上传高峰之外。",
    },
    {
      symptom: "版本化桶还原后每个对象只剩一个版本。",
      cause: "普通 mc mirror 复制对象当前状态——不显式做版本复制就不带旧版本。",
      fix: "若依赖桶版本化做时间点恢复，就显式镜像版本（带版本复制的 mc mirror），或把 Dockstash 的快照时间线本身当作版本历史——每个每日快照保存当天的对象状态。",
    },
    {
      symptom: "mc 命令失败：「Access Denied」或「invalid credentials」。",
      cause: "compose 里的凭据变了（例如轮换 MINIO_ROOT_USER / MINIO_ROOT_PASSWORD），容器里配置的 mc 别名还握着旧的一对。",
      fix: "重建容器让别名从当前 env 重建，或在容器里用新凭据重跑 mc alias set，再重跑备份。",
    },
  ],
  gotchas: [
    "优先 mc mirror 而非复制 /data 裸目录——MinIO 存对象加 xl.meta 元数据，裸拷贝可能丢进行中的 multipart 上传。",
    "经 S3 API 镜像，对象元数据、版本与标签才能一致保留。",
    "版本化桶要显式复制版本，否则只捕获每个对象的最新状态。",
  ],
  faq: [
    {
      question: "用 mc mirror 还是文件拷贝备份 MinIO？",
      answer:
        "用 mc mirror。它经 S3 API 读取对象：每个对象连同元数据都被原子捕获。/data 裸拷贝可能抓到进行中的 multipart 上传，或丢失元数据布局。",
    },
    {
      question: "mc mirror 保留版本和标签吗？",
      answer:
        "保留对象元数据和标签。版本化桶需要显式镜像版本，否则只捕获每个对象的当前版本。",
    },
    {
      question: "能还原进全新的 MinIO 实例吗？",
      answer:
        "能。把 mc 指向新实例，创建目标桶，把备份目录镜像回去。Dockstash 在中间步骤把镜像对象交给 restic。",
    },
    {
      question: "复制 /data 有可接受的时候吗？",
      answer:
        "只有 MinIO 完全停止且无在途写入时——即便那样元数据布局也必须原样保留。API 级镜像才是更安全、受支持的方式。",
    },
    {
      question: "MinIO 应该多久备份一次？",
      answer:
        "每日是务实默认——mc mirror 是增量的，安静的一天几乎零成本。Free 是手动 Backup Now；Pro 加最高每小时排程，Business 任意 cron。搭配每周还原演练。",
    },
    {
      question: "备份到底存放在哪里？",
      answer:
        "存放在你自己的存储 VPS 上，是经 SSH 推送的加密 restic 快照。Dockstash 从不把你的数据放在第三方云上——你指向一台由你掌控的机器，仓库用只有你持有的密码加密。",
    },
    {
      question: "不做手动还原，如何知道备份可还原？",
      answer:
        "安排还原演练。Dockstash 把最新快照还原到隔离工作区，把每个还原文件与源逐字节比对——然后盖「通过/失败」徽章。每周演练持续证明你的桶回得来。",
    },
  ],
};
