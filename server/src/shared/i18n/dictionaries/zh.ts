import type { DictionaryShape } from './en.js';

export const zh: DictionaryShape = {
  common: {
    ok: '确定',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    yes: '是',
    no: '否',
  },
  errors: {
    badRequest: '请求无效。',
    unauthorized: '请先登录后再执行此操作。',
    forbidden: '您没有执行此操作的权限。',
    notFound: '找不到请求的资源。',
    conflict: '冲突：资源已存在。',
    internal: '我们这边出了点问题，请重试。',
    validationFailed: '验证失败。',
    projectNotFound: '未找到项目。',
    userNotFound: '未找到用户。',
    invalidCredentials: '邮箱或密码不正确。',
    emailAlreadyRegistered: '该邮箱已被注册。',
    passwordTooShort: '密码至少需要 8 个字符。',
    emailNotVerified: '请先验证您的电子邮件地址以继续。',
  },
  auth: {
    login: {
      title: '登录',
      email: '邮箱',
      password: '密码',
      submit: '登录',
      submitting: '登录中…',
      forgot: '忘记密码？',
    },
    register: {
      title: '创建账户',
      submit: '创建账户',
    },
    reset: {
      title: '重置密码',
      submit: '重置',
      sent: '重置链接已发送到您的邮箱。',
      tokenInvalid: '该密码重置链接无效或已过期。请重新请求。',
    },
    verify: {
      success: '您的电子邮件地址已验证。您现在可以使用 Dockstash。',
      resent: '如果该账户需要验证，新的链接正在发送中。',
      tokenInvalid: '该验证链接无效或已过期。',
    },
    otp: {
      sent: '验证码已发送到您的邮箱。',
      invalid: '该验证码无效或已过期。',
      tooManyAttempts: '错误验证码次数过多。请重新登录以获取新验证码。',
    },
    oauth: {
      providerNotEnabled: '该登录方式未启用。',
    },
  },
  billing: {
    checkout: {
      title: '结算',
      submit: '立即支付',
      success: '已收到付款。感谢！',
    },
    portal: {
      title: '账单',
    },
    error: {
      notConfigured: '支付提供方未配置。',
      userNotFound: '未找到用户。',
      noCustomer: '未找到此用户的账单客户。',
      noSubscription: '未找到此用户的有效订阅。',
      providerFailure: '支付提供方错误：{{message}}',
    },
    entitlements: {
      projectLimitReached: '您的套餐不允许添加更多项目。请升级以添加更多。',
      schedulesLocked: '当前套餐不支持定时备份。',
      frequencyNotAllowed: '您的套餐不支持该定时频率。',
      restoreDrillsLocked: '自动恢复演练在 Pro 和 Business 套餐中可用。',
      pitrLocked: '时间点恢复在 Pro 和 Business 套餐中可用。',
      mirrorLocked: '镜像模式在 Business 套餐中可用。',
      alertsLocked: '警报通道（邮件和 Webhook）在 Pro 和 Business 套餐中可用。',
      multiVpsLocked: '多 VPS 集群视图在 Business 套餐中可用。',
      projectPaused: '该项目已暂停。请重新激活或升级以运行备份。',
      selectionInvalid: '请选择 1 到 {{cap}} 个项目保持活动。',
      notOwner: '您不是其中一个或多个项目的所有者。',
    },
  },
  email: {
    contact: {
      confirmation: '您的邮件已发送。我们会尽快与您联系。',
    },
    verifyEmail: {
      subject: '验证您的电子邮件地址',
      body:
        '欢迎使用 Dockstash。请确认您的电子邮件地址以激活账户。\n\n' +
        '请点击以下链接，或将其粘贴到浏览器中：\n\n{{verifyUrl}}\n\n' +
        '此链接将在 24 小时后失效。如果您没有创建账户，请忽略此邮件。\n',
    },
    passwordReset: {
      subject: '重置您的密码',
      body:
        '您收到此邮件，是因为您（或他人）请求重置账户密码。\n\n' +
        '请点击以下链接，或将其粘贴到浏览器中以完成操作：\n\n{{resetUrl}}\n\n' +
        '如果不是您本人请求的，请忽略此邮件，密码将保持不变。\n',
    },
    passwordChanged: {
      subject: '您的密码已更改',
      body:
        '您收到此邮件，是因为您的账户密码刚刚被更改。\n\n' +
        '如果不是您本人操作，请立即联系我们。',
    },
    welcome: {
      subject: '欢迎使用 Dockstash',
      body:
        '欢迎使用 Dockstash，{{name}}。\n\n' +
        '请在 {{clientUrl}} 登录并管理您的备份。\n',
    },
    paymentReceipt: {
      subject: '您的 Dockstash 收据',
      body:
        '感谢您为 {{plan}} 计划支付 {{amount}}。\n\n' +
        '在 {{clientUrl}}/billing 管理账单。\n',
    },
    dunning: {
      subject: 'Dockstash 订阅付款问题',
      body:
        '我们无法为 {{plan}} 计划扣款。\n\n' +
        '请在 {{graceEndsAt}} 之前更新支付方式以保留此计划：{{clientUrl}}/billing。\n',
    },
    drillFailure: {
      subject: '恢复演练失败 — 项目 {{project}}',
      body:
        '项目「{{project}}」的计划恢复演练于 {{failedAt}} 失败。\n\n' +
        '错误：{{error}}\n' +
        '最近一次成功备份：{{lastGoodAt}}\n\n' +
        '打开仪表板：{{clientUrl}}/projects/{{projectId}}\n',
    },
    backupFailure: {
      subject: '备份失败 — 项目 {{project}}',
      body:
        '项目「{{project}}」的备份运行于 {{failedAt}} 失败。\n\n' +
        '错误：{{error}}\n' +
        '最近一次成功备份：{{lastGoodAt}}\n\n' +
        '打开仪表板：{{clientUrl}}/projects/{{projectId}}\n',
    },
    restoreFailure: {
      subject: '恢复失败 — 项目 {{project}}',
      body:
        '项目「{{project}}」的一次恢复于 {{failedAt}} 失败。\n\n' +
        '错误：{{error}}\n' +
        '最近一次成功备份：{{lastGoodAt}}\n\n' +
        '打开仪表板：{{clientUrl}}/projects/{{projectId}}\n',
    },
    heartbeatMiss: {
      subject: '静默停滞 — {{project}} 已 {{hours}} 小时无备份',
      body:
        '项目「{{project}}」在过去 {{hours}} 小时内没有成功的备份。\n\n' +
        '最近一次成功备份：{{lastGoodAt}}\n\n' +
        '打开仪表板：{{clientUrl}}/projects/{{projectId}}\n',
    },
    loginOtp: {
      subject: '您的 Dockstash 登录验证码',
      body:
        '您的登录验证码是：{{code}}\n\n' +
        '它将在 {{minutes}} 分钟后过期。如果您没有尝试登录，请立即修改密码。\n',
    },
    neverRun: '从未',
  },
  audit: {
    error: {
      notOwner: '您没有权限查看此审计日志。',
    },
  },
  health: {
    error: {
      unavailable: '健康检查不可用：{{reason}}',
    },
  },
  backups: {
    error: {
      pathNotAllowed: '路径 {{path}} 不在此备份目标允许的项目目录内。',
      projectNotFound: '项目未找到。',
      notOwner: '您不是此项目的所有者。',
      scanFailed: '项目扫描失败：{{message}}',
      discoverFailed: '发现失败：{{message}}',
      noAdapter: '没有备份适配器与服务 {{service}} 匹配。',
      dumpFailed: '{{service}} 的数据库转储失败：{{message}}',
      resticFailed: 'Restic 备份失败：{{message}}',
      backupFailed: '备份失败：{{message}}',
      noSpace: '磁盘空间不足（剩余={{free}} 字节）。',
      runnerUnavailable: '快照列表不可用：备份运行器尚未配置。',
      snapshotsFailed: '无法列出快照：{{message}}',
      noSnapshotBeforeTs: '在 {{ts}} 或之前不存在快照。',
      restoreFailed: '恢复失败：{{message}}',
      restoreSnapshotNotFound: '在此项目的仓库中未找到快照 {{snapshotId}}。',
      restoreUnsupportedEngine: '{{type}} 暂不支持原地恢复。请恢复到新位置并手动加载制品。',
      restoreNeedsDocker: '数据库恢复需要 Docker 运行时；本服务器未配置。',
      restoreContainerNotRunning: '容器 {{container}} 未运行 — 请启动后重试恢复。',
      restorePathOutsideRoots: '快照内容（{{path}}）不在允许的项目目录内；请改为恢复到新位置。',
    },
    success: {
      backupComplete: '备份已成功完成。',
    },
    check: {
      pass: '仓库检查通过。',
      fail: '仓库检查失败：{{message}}',
    },
    drill: {
      pass: '恢复演练通过：字节和行差异均干净。',
      fail: '恢复演练失败：{{message}}',
      failMismatches: '恢复演练失败：{{count}} 处不匹配 — {{details}}',
      nothingToRestore: '没有可恢复的快照。',
    },
  },
  scheduler: {
    error: {
      invalidCron: '无效的 cron 表达式：{{expr}}',
      scheduleNotFound: '未找到计划。',
      notOwner: '您不是此计划的所有者。',
      repoBusy: '仓库 {{projectId}} 正忙 — 另一个任务正在运行。',
      entitlementDenied: '您的套餐不允许此计划。',
      pruneFailed: 'Prune 失败：{{message}}',
    },
    success: {
      scheduled: '计划已保存。',
      enqueued: '任务已加入队列。',
      prunePassed: 'Prune 成功完成。',
    },
    job: {
      failedRetriesExhausted: '任务在 {{attempts}} 次尝试后失败：{{message}}',
    },
  },
  recovery: {
    error: {
      importInvalid: '导入信封无效：{{message}}',
      importTampered: '导入信封完整性校验失败——无法解密某个密钥。',
      keyVersionMismatch: '导入信封引用了此代理无法解密的密钥版本 {{version}}。',
      plaintextForbidden: '导入信封中包含明文密钥字段（{{field}}）——拒绝导入。',
      selfBackupFailed: '自备份失败：{{message}}',
      userNotFound: '未找到账户。',
      notOwner: '您不是所引用的一个或多个项目的所有者。',
      storageUnreachable: '存储仓库不可达：{{message}}',
    },
    success: {
      exportReady: '配置导出已就绪。',
      imported: '配置导入成功完成。',
      escrowEnabled: '已生成恢复代码。请立即保存——它们不会再次显示。',
      selfBackupComplete: '自备份成功完成。',
    },
  },
  settings: {
    error: {
      storageNotConfigured: '存储尚未配置。请先添加您的存储 VPS 连接。',
      connectionFailed: '存储连接测试失败：{{message}}',
      hostKeyNotPinned: '存储主机密钥尚未验证。请先运行连接测试。',
    },
  },
  agents: {
    error: {
      notFound: '未找到代理。',
      notOwner: '您不拥有此代理。',
      unauthorized: '代理认证失败。',
      jobNotFound: '未找到代理任务。',
      drillNotSupported: '远程代理暂不支持恢复演练。',
      duplicateHost: '该主机的代理已存在。',
    },
  },
  language: {
    switcher: {
      label: '语言',
    },
    names: {
      en: 'English',
      ar: 'العربية',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
      ru: 'Русский',
      zh: '中文',
    },
  },
  superadmin: {
    error: {
      cannotModifySuperadmin: '超级管理员账户不能被修改或删除。',
    },
    success: {
      roleChanged: '用户角色已更新。',
      userVerified: '用户邮箱已标记为已验证。',
      legalHoldUpdated: '法律保留状态已更新。',
      deletionScheduled: '账户删除已排期。',
    },
  },
  security: {
    error: {
      rateLimited: '请求过多，请稍后重试。',
      csrfInvalid: 'CSRF 令牌缺失或无效。',
      hostKeyMalformed: '存储主机密钥指纹格式不正确。',
      hostKeyMismatch: '存储主机密钥不匹配。期望 {{expected}}，实际 {{observed}}。已拒绝连接。',
    },
    legalHold: {
      pruneSkipped: '保留策略清理已跳过：项目处于法律保留状态。',
      deletionBlocked: '在法律保留处于激活状态时，账户删除被阻止。',
    },
    deletion: {
      alreadyScheduled: '账户删除已被计划。',
      notConfigured: '删除队列未配置。',
      purgeFailed: '备份仓库清理失败：{{message}}',
      warningSubject: '您的 Dockstash 账户将被删除',
      warningBody:
        '您好 {{name}}，您请求删除 Dockstash 账户。您的数据将于 {{purgeAt}} 永久删除。',
    },
  },
};
