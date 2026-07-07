import type { DictionaryShape } from './en.js';

export const ar: DictionaryShape = {
  common: {
    ok: 'حسناً',
    cancel: 'إلغاء',
    save: 'حفظ',
    delete: 'حذف',
    yes: 'نعم',
    no: 'لا',
  },
  errors: {
    badRequest: 'طلب غير صالح.',
    unauthorized: 'يجب تسجيل الدخول للقيام بذلك.',
    forbidden: 'ليس لديك إذن للقيام بذلك.',
    notFound: 'المورد المطلوب غير موجود.',
    conflict: 'تعارض: المورد موجود بالفعل.',
    internal: 'حدث خطأ لدينا. يرجى المحاولة مرة أخرى.',
    validationFailed: 'فشل التحقق.',
    projectNotFound: 'المشروع غير موجود.',
    userNotFound: 'المستخدم غير موجود.',
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    emailAlreadyRegistered: 'هذا البريد الإلكتروني مسجل بالفعل.',
    passwordTooShort: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
    emailNotVerified: 'يرجى تأكيد عنوان بريدك الإلكتروني للمتابعة.',
    ssrf: {
      scheme: 'هذا الرابط غير مسموح به. يُقبل فقط http(s) إلى مضيفين عامّين.',
      private: 'يشير هذا الرابط إلى عنوان داخلي أو محجوز. استخدم اسم مضيف عام.',
      dnsFailed: 'تعذّر تحليل هذا الرابط.',
      tooManyRedirects: 'أعاد هذا الرابط توجيهاً كثيراً.',
    },
  },
  auth: {
    login: {
      title: 'تسجيل الدخول',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      submit: 'دخول',
      submitting: 'جاري تسجيل الدخول…',
      forgot: 'نسيت كلمة المرور؟',
    },
    register: {
      title: 'إنشاء حساب',
      submit: 'إنشاء الحساب',
    },
    reset: {
      title: 'إعادة تعيين كلمة المرور',
      submit: 'إعادة التعيين',
      sent: 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.',
      tokenInvalid: 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.',
    },
    verify: {
      success: 'تم تأكيد عنوان بريدك الإلكتروني. يمكنك الآن استخدام Dockstash.',
      resent: 'إذا كان هذا الحساب بحاجة إلى تأكيد، فإن رابطًا جديدًا في طريقه إليك.',
      tokenInvalid: 'رابط التأكيد غير صالح أو منتهي الصلاحية.',
    },
    otp: {
      sent: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.',
      invalid: 'رمز التحقق غير صالح أو انتهت صلاحيته.',
      tooManyAttempts: 'عدد كبير جدًا من الرموز الخاطئة. يرجى تسجيل الدخول مرة أخرى للحصول على رمز جديد.',
    },
    oauth: {
      providerNotEnabled: 'مزوّد تسجيل الدخول هذا غير مفعّل.',
    },
  },
  billing: {
    checkout: {
      title: 'الدفع',
      submit: 'ادفع الآن',
      success: 'تم استلام الدفع. شكراً لك!',
    },
    portal: {
      title: 'الفوترة',
    },
    error: {
      notConfigured: 'مزود الدفع غير مُهيأ.',
      userNotFound: 'المستخدم غير موجود.',
      noCustomer: 'لا يوجد عميل فوترة لهذا المستخدم.',
      noSubscription: 'لا يوجد اشتراك نشط لهذا المستخدم.',
      providerFailure: 'خطأ من مزود الدفع: {{message}}',
    },
    entitlements: {
      projectLimitReached: 'خطتك لا تسمح بمزيد من المشاريع. قم بالترقية لإضافة المزيد.',
      schedulesLocked: 'النسخ الاحتياطية المجدولة غير متاحة في خطتك الحالية.',
      frequencyNotAllowed: 'خطتك لا تسمح بهذا التكرار للجدولة.',
      restoreDrillsLocked: 'اختبارات الاستعادة التلقائية متاحة في خطط Pro وBusiness.',
      pitrLocked: 'الاستعادة إلى نقطة زمنية متاحة في خطط Pro وBusiness.',
      mirrorLocked: 'وضع النسخ المتطابق متاح في خطة Business.',
      alertsLocked: 'قنوات التنبيه (البريد الإلكتروني وWebhooks) متاحة في خطط Pro وBusiness.',
      agentLimitReached: 'وصلت إلى حد الوكلاء في خطتك. قم بالترقية لربط المزيد من الخوادم.',
      projectPaused: 'هذا المشروع متوقف. أعد تفعيله أو قم بالترقية لتشغيل النسخ الاحتياطي.',
      selectionInvalid: 'يجب اختيار ما بين مشروع واحد و{{cap}} مشاريع للإبقاء عليها نشطة.',
      notOwner: 'أنت لا تملك واحداً أو أكثر من تلك المشاريع.',
    },
  },
  email: {
    contact: {
      confirmation: 'تم إرسال بريدك الإلكتروني. سنتواصل معك قريباً.',
    },
    verifyEmail: {
      subject: 'تأكيد عنوان بريدك الإلكتروني',
      body:
        'مرحبًا بك في Dockstash. يرجى تأكيد عنوان بريدك الإلكتروني لتفعيل حسابك.\n\n' +
        'انقر على الرابط التالي أو الصقه في متصفحك:\n\n{{verifyUrl}}\n\n' +
        'تنتهي صلاحية هذا الرابط خلال 24 ساعة. إذا لم تُنشئ حسابًا، فتجاهل هذه الرسالة.\n',
    },
    passwordReset: {
      subject: 'إعادة تعيين كلمة المرور',
      body:
        'تلقيت هذه الرسالة لأنك (أو شخص آخر) طلبت إعادة تعيين كلمة مرور حسابك.\n\n' +
        'يرجى النقر على الرابط التالي أو لصقه في متصفحك لإكمال العملية:\n\n{{resetUrl}}\n\n' +
        'إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة المرور دون تغيير.\n',
    },
    passwordChanged: {
      subject: 'تم تغيير كلمة المرور',
      body:
        'تلقيت هذه الرسالة لأن كلمة مرور حسابك قد تم تغييرها للتو.\n\n' +
        'إذا لم تقم بذلك، اتصل بنا فوراً.',
    },
    welcome: {
      subject: 'مرحباً بك في Dockstash',
      body:
        'مرحباً بك في Dockstash يا {{name}}.\n\n' +
        'يمكنك تسجيل الدخول وإدارة نسخك الاحتياطية على {{clientUrl}}.\n',
    },
    paymentReceipt: {
      subject: 'إيصال Dockstash الخاص بك',
      body:
        'شكراً لدفعك مبلغ {{amount}} لخطة {{plan}}.\n\n' +
        'أدر الفوترة على {{clientUrl}}/billing.\n',
    },
    dunning: {
      subject: 'مشكلة في الدفع على اشتراك Dockstash',
      body:
        'تعذر علينا خصم قيمة خطة {{plan}} من وسيلة الدفع.\n\n' +
        'يرجى التحديث قبل {{graceEndsAt}} للحفاظ على الخطة نشطة: {{clientUrl}}/billing.\n',
    },
    downgradeNotice: {
      subject: 'تم تغيير خطتك في Dockstash إلى Free',
      body:
        'انتهت صلاحية خطة {{plan}} وحسابك الآن على خطة Free.\n\n' +
        'نسخك الاحتياطية الحالية آمنة — لم يُحذف أي شيء. المشاريع التي تتجاوز ' +
        'حد Free متوقفة (للقراءة فقط) حتى تُعيد الاشتراك: {{clientUrl}}/billing.\n',
    },
    reactivation: {
      subject: 'اشتراكك في Dockstash نشط مرة أخرى',
      body:
        'خبر سار — اشتراك {{plan}} نشط مرة أخرى وعادت المشاريع ' +
        'المتوقفة إلى العمل.\n\n' +
        'أدر حسابك على {{clientUrl}}/billing.\n',
    },
    drillFailure: {
      subject: 'فشل اختبار الاستعادة — المشروع {{project}}',
      body:
        'فشل اختبار استعادة مجدول للمشروع "{{project}}" في {{failedAt}}.\n\n' +
        'الخطأ: {{error}}\n' +
        'آخر نسخة احتياطية ناجحة: {{lastGoodAt}}\n\n' +
        'افتح لوحة التحكم: {{clientUrl}}/projects/{{projectId}}\n',
    },
    backupFailure: {
      subject: 'فشل النسخ الاحتياطي — المشروع {{project}}',
      body:
        'فشل تشغيل نسخ احتياطي للمشروع "{{project}}" في {{failedAt}}.\n\n' +
        'الخطأ: {{error}}\n' +
        'آخر نسخة احتياطية ناجحة: {{lastGoodAt}}\n\n' +
        'افتح لوحة التحكم: {{clientUrl}}/projects/{{projectId}}\n',
    },
    restoreFailure: {
      subject: 'فشل الاستعادة — المشروع {{project}}',
      body:
        'فشلت عملية استعادة للمشروع "{{project}}" في {{failedAt}}.\n\n' +
        'الخطأ: {{error}}\n' +
        'آخر نسخة احتياطية ناجحة: {{lastGoodAt}}\n\n' +
        'افتح لوحة التحكم: {{clientUrl}}/projects/{{projectId}}\n',
    },
    mirrorFailure: {
      subject: 'فشل النسخ المتطابق — المشروع {{project}}',
      body:
        'فشل تشغيل نسخ متطابق للمشروع "{{project}}" في {{failedAt}}.\n\n' +
        'الخطأ: {{error}}\n' +
        'آخر نسخة احتياطية ناجحة: {{lastGoodAt}}\n\n' +
        'افتح لوحة التحكم: {{clientUrl}}/projects/{{projectId}}\n',
    },
    heartbeatMiss: {
      subject: 'توقف صامت — لا توجد نسخة احتياطية منذ {{hours}} ساعة للمشروع {{project}}',
      body:
        'لم يتم تشغيل نسخة احتياطية ناجحة للمشروع "{{project}}" خلال آخر {{hours}} ساعة.\n\n' +
        'آخر نسخة احتياطية ناجحة: {{lastGoodAt}}\n\n' +
        'افتح لوحة التحكم: {{clientUrl}}/projects/{{projectId}}\n',
    },
    loginOtp: {
      subject: 'رمز تسجيل الدخول إلى Dockstash',
      body:
        'رمز التحقق لتسجيل الدخول هو: {{code}}\n\n' +
        'تنتهي صلاحيته خلال {{minutes}} دقائق. إذا لم تحاول تسجيل الدخول، فغيّر كلمة المرور فورًا.\n',
    },
    neverRun: 'أبداً',
  },
  audit: {
    error: {
      notOwner: 'ليس لديك إذن لعرض سجل التدقيق هذا.',
    },
  },
  health: {
    error: {
      unavailable: 'فحص الصحة غير متاح: {{reason}}',
    },
  },
  backups: {
    error: {
      pathNotAllowed: 'المسار {{path}} ليس ضمن مجلدات المشاريع المسموح بها لهدف النسخ الاحتياطي هذا.',
      projectNotFound: 'المشروع غير موجود.',
      notOwner: 'أنت لا تملك هذا المشروع.',
      scanFailed: 'فشل مسح المشروع: {{message}}',
      discoverFailed: 'فشل الاكتشاف: {{message}}',
      noAdapter: 'لا يوجد محول نسخ احتياطي مطابق للخدمة {{service}}.',
      dumpFailed: 'فشل تفريغ قاعدة البيانات لـ {{service}}: {{message}}',
      resticFailed: 'فشل النسخ الاحتياطي لـ Restic: {{message}}',
      backupFailed: 'فشل النسخ الاحتياطي: {{message}}',
      noSpace: 'مساحة القرص غير كافية (المتاح={{free}} بايت).',
      runnerUnavailable: 'قائمة اللقطات غير متاحة: مشغّل النسخ الاحتياطي غير مُهيأ.',
      snapshotsFailed: 'تعذّر سرد اللقطات: {{message}}',
      noSnapshotBeforeTs: 'لا توجد لقطة عند {{ts}} أو قبلها.',
      restoreFailed: 'فشلت الاستعادة: {{message}}',
      mirrorNotConfigured: 'النسخ المتطابق غير مُهيأ أو غير مفعّل لهذا المشروع.',
      mirrorFailed: 'فشل تشغيل النسخ المتطابق: {{message}}',
      restoreSnapshotNotFound: 'لم يتم العثور على اللقطة {{snapshotId}} في مستودع هذا المشروع.',
      restoreUnsupportedEngine: 'الاستعادة في المكان غير مدعومة بعد لـ {{type}}. استعد إلى موقع جديد وحمّل الملف يدوياً.',
      restoreNeedsDocker: 'تتطلب استعادة قاعدة البيانات بيئة Docker؛ وهي غير مهيأة على هذا الخادم.',
      restoreContainerNotRunning: 'الحاوية {{container}} متوقفة — شغّلها ثم أعد محاولة الاستعادة.',
      restorePathOutsideRoots: 'محتوى اللقطة ({{path}}) خارج أدلة المشروع المسموح بها؛ استعد إلى موقع جديد بدلاً من ذلك.',
    },
    success: {
      backupComplete: 'اكتمل النسخ الاحتياطي بنجاح.',
      mirrorComplete: 'اكتمل النسخ المتطابق بنجاح.',
    },
    check: {
      pass: 'نجح فحص المستودع.',
      fail: 'فشل فحص المستودع: {{message}}',
    },
    drill: {
      pass: 'نجح تدريب الاستعادة: فروق البايت والصفوف نظيفة.',
      fail: 'فشل تدريب الاستعادة: {{message}}',
      failMismatches: 'فشل تدريب الاستعادة: {{count}} عدم تطابق — {{details}}',
      nothingToRestore: 'لا توجد لقطات لاستعادتها.',
    },
  },
  scheduler: {
    error: {
      invalidCron: 'تعبير cron غير صالح: {{expr}}',
      scheduleNotFound: 'الجدول غير موجود.',
      notOwner: 'أنت لا تملك هذا الجدول.',
      repoBusy: 'المستودع {{projectId}} مشغول — يوجد مهمة أخرى قيد التنفيذ.',
      entitlementDenied: 'خطتك لا تسمح بهذا الجدول.',
      pruneFailed: 'فشل التقليم: {{message}}',
    },
    success: {
      scheduled: 'تم حفظ الجدول.',
      enqueued: 'تم إضافة المهمة إلى قائمة الانتظار.',
      prunePassed: 'اكتمل التقليم بنجاح.',
      pruneSkippedPaused: 'تم تخطي حذف الاحتفاظ: المشروع متوقف؛ يتم الاحتفاظ باللقطات المخزَّنة.',
    },
    job: {
      failedRetriesExhausted: 'فشلت المهمة بعد {{attempts}} محاولات: {{message}}',
    },
  },
  recovery: {
    error: {
      importInvalid: 'مغلف الاستيراد غير صالح: {{message}}',
      importTampered: 'فشل فحص سلامة مغلف الاستيراد — تعذر فك تشفير أحد الأسرار.',
      keyVersionMismatch: 'يشير مغلف الاستيراد إلى إصدار المفتاح {{version}} الذي لا يمكن لهذا الوكيل فك تشفيره.',
      plaintextForbidden: 'يحتوي مغلف الاستيراد على حقل سر بنص عادي ({{field}}) — رفض الاستيراد.',
      selfBackupFailed: 'فشل النسخ الاحتياطي الذاتي: {{message}}',
      userNotFound: 'لم يتم العثور على الحساب.',
      notOwner: 'أنت لا تملك واحدًا أو أكثر من المشاريع المشار إليها.',
      storageUnreachable: 'مستودع التخزين غير قابل للوصول: {{message}}',
    },
    success: {
      exportReady: 'تصدير الإعدادات جاهز.',
      imported: 'اكتمل استيراد الإعدادات بنجاح.',
      escrowEnabled: 'تم إنشاء رموز الاسترداد. احفظها الآن — لن تُعرض مرة أخرى.',
      selfBackupComplete: 'اكتمل النسخ الاحتياطي الذاتي بنجاح.',
    },
  },
  settings: {
    error: {
      storageNotConfigured: 'التخزين غير مُهيأ. أضف اتصال خادم التخزين الخاص بك أولاً.',
      connectionFailed: 'فشل اختبار الاتصال بالتخزين: {{message}}',
      hostKeyNotPinned: 'لم يتم التحقق من مفتاح مضيف التخزين بعد. شغّل اختبار الاتصال أولاً.',
    },
  },
  agents: {
    error: {
      notFound: 'لم يتم العثور على الوكيل.',
      notOwner: 'أنت لا تملك هذا الوكيل.',
      unauthorized: 'فشلت مصادقة الوكيل.',
      jobNotFound: 'لم يتم العثور على مهمة الوكيل.',
      drillNotSupported: 'تمارين الاستعادة غير مدعومة بعد على الوكلاء البعيدين.',
      mirrorNotSupported: 'مهام النسخ المتطابق غير مدعومة بعد على الوكلاء البعيدين.',
      duplicateHost: 'يوجد وكيل لهذا المضيف بالفعل.',
    },
  },
  language: {
    switcher: {
      label: 'اللغة',
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
      cannotModifySuperadmin: 'لا يمكن تعديل حسابات المشرف الأعلى أو حذفها.',
    },
    success: {
      roleChanged: 'تم تحديث دور المستخدم.',
      userVerified: 'تم وضع علامة على بريد المستخدم كمُتحقق منه.',
      legalHoldUpdated: 'تم تحديث الحجز القانوني.',
      deletionScheduled: 'تمت جدولة حذف الحساب.',
    },
  },
  security: {
    error: {
      rateLimited: 'طلبات كثيرة جدًا. حاول مرة أخرى لاحقًا.',
      csrfInvalid: 'رمز CSRF مفقود أو غير صالح.',
      hostKeyMalformed: 'بصمة مفتاح مضيف التخزين غير صحيحة.',
      hostKeyMismatch: 'عدم تطابق مفتاح مضيف التخزين. المتوقع {{expected}}، الملاحظ {{observed}}. تم رفض الاتصال.',
    },
    legalHold: {
      pruneSkipped: 'تم تخطي حذف الاحتفاظ: المشروع تحت حجز قانوني.',
      deletionBlocked: 'حذف الحساب محظور أثناء وجود حجز قانوني نشط.',
    },
    deletion: {
      alreadyScheduled: 'حذف الحساب مجدول بالفعل.',
      notConfigured: 'طابور الحذف غير مُهيَّأ.',
      purgeFailed: 'فشل تطهير مستودع النسخ الاحتياطي: {{message}}',
      warningSubject: 'سيتم حذف حساب Dockstash الخاص بك',
      warningBody:
        'مرحبًا {{name}}،\n\nطلبت حذف حسابك على Dockstash. ستُطهر بياناتك — بما في ذلك كل لقطة نسخ احتياطي — نهائيًا في {{purgeAt}}.\n\nإذا غيرت رأيك، فسجل الدخول وألغِ الحذف قبل ذلك الوقت.',
    },
  },
};
