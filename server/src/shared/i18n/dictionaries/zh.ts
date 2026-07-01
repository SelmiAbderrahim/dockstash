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
      projectPaused: '该项目已暂停。请重新激活或升级以运行备份。',
      selectionInvalid: '请选择 1 到 {{cap}} 个项目保持活动。',
      notOwner: '您不是其中一个或多个项目的所有者。',
      trialAlreadyClaimed: '该账户已经使用过试用。',
    },
  },
  email: {
    contact: {
      confirmation: '您的邮件已发送。我们会尽快与您联系。',
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
      pathNotAllowed: '路径 {{path}} 不在允许的 /var/www 根目录下。',
      projectNotFound: '项目未找到。',
      notOwner: '您不是此项目的所有者。',
      scanFailed: '项目扫描失败：{{message}}',
      noAdapter: '没有备份适配器与服务 {{service}} 匹配。',
      dumpFailed: '{{service}} 的数据库转储失败：{{message}}',
      resticFailed: 'Restic 备份失败：{{message}}',
      backupFailed: '备份失败：{{message}}',
      noSpace: '磁盘空间不足（剩余={{free}} 字节）。',
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
      notOwner: '您不是所引用的一个或多个项目的所有者。',
      storageUnreachable: '存储仓库不可达：{{message}}',
    },
    success: {
      exportReady: '配置导出已就绪。',
      imported: '配置导入成功完成。',
      selfBackupComplete: '自备份成功完成。',
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
