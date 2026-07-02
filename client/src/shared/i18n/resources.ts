import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enAuth from './locales/en/auth.json';
import enBilling from './locales/en/billing.json';
import enEmail from './locales/en/email.json';
import enLanguage from './locales/en/language.json';
import enProjects from './locales/en/projects.json';
import enProjectDetail from './locales/en/projectDetail.json';
import enSnapshots from './locales/en/snapshots.json';
import enSettings from './locales/en/settings.json';
import enWizard from './locales/en/wizard.json';
import enMarketing from './locales/en/marketing.json';
import enSuperadmin from './locales/en/superadmin.json';
import enGuide from './locales/en/guide.json';
import enProfile from './locales/en/profile.json';

import arCommon from './locales/ar/common.json';
import arErrors from './locales/ar/errors.json';
import arAuth from './locales/ar/auth.json';
import arBilling from './locales/ar/billing.json';
import arEmail from './locales/ar/email.json';
import arLanguage from './locales/ar/language.json';
import arProjects from './locales/ar/projects.json';
import arProjectDetail from './locales/ar/projectDetail.json';
import arSnapshots from './locales/ar/snapshots.json';
import arSettings from './locales/ar/settings.json';
import arWizard from './locales/ar/wizard.json';
import arMarketing from './locales/ar/marketing.json';
import arSuperadmin from './locales/ar/superadmin.json';
import arGuide from './locales/ar/guide.json';
import arProfile from './locales/ar/profile.json';

import frCommon from './locales/fr/common.json';
import frErrors from './locales/fr/errors.json';
import frAuth from './locales/fr/auth.json';
import frBilling from './locales/fr/billing.json';
import frEmail from './locales/fr/email.json';
import frLanguage from './locales/fr/language.json';
import frProjects from './locales/fr/projects.json';
import frProjectDetail from './locales/fr/projectDetail.json';
import frSnapshots from './locales/fr/snapshots.json';
import frSettings from './locales/fr/settings.json';
import frWizard from './locales/fr/wizard.json';
import frMarketing from './locales/fr/marketing.json';
import frSuperadmin from './locales/fr/superadmin.json';
import frGuide from './locales/fr/guide.json';
import frProfile from './locales/fr/profile.json';

import deCommon from './locales/de/common.json';
import deErrors from './locales/de/errors.json';
import deAuth from './locales/de/auth.json';
import deBilling from './locales/de/billing.json';
import deEmail from './locales/de/email.json';
import deLanguage from './locales/de/language.json';
import deProjects from './locales/de/projects.json';
import deProjectDetail from './locales/de/projectDetail.json';
import deSnapshots from './locales/de/snapshots.json';
import deSettings from './locales/de/settings.json';
import deWizard from './locales/de/wizard.json';
import deMarketing from './locales/de/marketing.json';
import deSuperadmin from './locales/de/superadmin.json';
import deGuide from './locales/de/guide.json';
import deProfile from './locales/de/profile.json';

import esCommon from './locales/es/common.json';
import esErrors from './locales/es/errors.json';
import esAuth from './locales/es/auth.json';
import esBilling from './locales/es/billing.json';
import esEmail from './locales/es/email.json';
import esLanguage from './locales/es/language.json';
import esProjects from './locales/es/projects.json';
import esProjectDetail from './locales/es/projectDetail.json';
import esSnapshots from './locales/es/snapshots.json';
import esSettings from './locales/es/settings.json';
import esWizard from './locales/es/wizard.json';
import esMarketing from './locales/es/marketing.json';
import esSuperadmin from './locales/es/superadmin.json';
import esGuide from './locales/es/guide.json';
import esProfile from './locales/es/profile.json';

import ruCommon from './locales/ru/common.json';
import ruErrors from './locales/ru/errors.json';
import ruAuth from './locales/ru/auth.json';
import ruBilling from './locales/ru/billing.json';
import ruEmail from './locales/ru/email.json';
import ruLanguage from './locales/ru/language.json';
import ruProjects from './locales/ru/projects.json';
import ruProjectDetail from './locales/ru/projectDetail.json';
import ruSnapshots from './locales/ru/snapshots.json';
import ruSettings from './locales/ru/settings.json';
import ruWizard from './locales/ru/wizard.json';
import ruMarketing from './locales/ru/marketing.json';
import ruSuperadmin from './locales/ru/superadmin.json';
import ruGuide from './locales/ru/guide.json';
import ruProfile from './locales/ru/profile.json';

import zhCommon from './locales/zh/common.json';
import zhErrors from './locales/zh/errors.json';
import zhAuth from './locales/zh/auth.json';
import zhBilling from './locales/zh/billing.json';
import zhEmail from './locales/zh/email.json';
import zhLanguage from './locales/zh/language.json';
import zhProjects from './locales/zh/projects.json';
import zhProjectDetail from './locales/zh/projectDetail.json';
import zhSnapshots from './locales/zh/snapshots.json';
import zhSettings from './locales/zh/settings.json';
import zhWizard from './locales/zh/wizard.json';
import zhMarketing from './locales/zh/marketing.json';
import zhSuperadmin from './locales/zh/superadmin.json';
import zhGuide from './locales/zh/guide.json';
import zhProfile from './locales/zh/profile.json';

import type { Namespace, SupportedLocale } from './locales.js';

export const RESOURCES: Record<SupportedLocale, Record<Namespace, unknown>> = {
  en: {
    common: enCommon,
    errors: enErrors,
    auth: enAuth,
    billing: enBilling,
    email: enEmail,
    language: enLanguage,
    projects: enProjects,
    projectDetail: enProjectDetail,
    snapshots: enSnapshots,
    settings: enSettings,
    wizard: enWizard,
    marketing: enMarketing,
    superadmin: enSuperadmin,
    guide: enGuide,
    profile: enProfile,
  },
  ar: {
    common: arCommon,
    errors: arErrors,
    auth: arAuth,
    billing: arBilling,
    email: arEmail,
    language: arLanguage,
    projects: arProjects,
    projectDetail: arProjectDetail,
    snapshots: arSnapshots,
    settings: arSettings,
    wizard: arWizard,
    marketing: arMarketing,
    superadmin: arSuperadmin,
    guide: arGuide,
    profile: arProfile,
  },
  fr: {
    common: frCommon,
    errors: frErrors,
    auth: frAuth,
    billing: frBilling,
    email: frEmail,
    language: frLanguage,
    projects: frProjects,
    projectDetail: frProjectDetail,
    snapshots: frSnapshots,
    settings: frSettings,
    wizard: frWizard,
    marketing: frMarketing,
    superadmin: frSuperadmin,
    guide: frGuide,
    profile: frProfile,
  },
  de: {
    common: deCommon,
    errors: deErrors,
    auth: deAuth,
    billing: deBilling,
    email: deEmail,
    language: deLanguage,
    projects: deProjects,
    projectDetail: deProjectDetail,
    snapshots: deSnapshots,
    settings: deSettings,
    wizard: deWizard,
    marketing: deMarketing,
    superadmin: deSuperadmin,
    guide: deGuide,
    profile: deProfile,
  },
  es: {
    common: esCommon,
    errors: esErrors,
    auth: esAuth,
    billing: esBilling,
    email: esEmail,
    language: esLanguage,
    projects: esProjects,
    projectDetail: esProjectDetail,
    snapshots: esSnapshots,
    settings: esSettings,
    wizard: esWizard,
    marketing: esMarketing,
    superadmin: esSuperadmin,
    guide: esGuide,
    profile: esProfile,
  },
  ru: {
    common: ruCommon,
    errors: ruErrors,
    auth: ruAuth,
    billing: ruBilling,
    email: ruEmail,
    language: ruLanguage,
    projects: ruProjects,
    projectDetail: ruProjectDetail,
    snapshots: ruSnapshots,
    settings: ruSettings,
    wizard: ruWizard,
    marketing: ruMarketing,
    superadmin: ruSuperadmin,
    guide: ruGuide,
    profile: ruProfile,
  },
  zh: {
    common: zhCommon,
    errors: zhErrors,
    auth: zhAuth,
    billing: zhBilling,
    email: zhEmail,
    language: zhLanguage,
    projects: zhProjects,
    projectDetail: zhProjectDetail,
    snapshots: zhSnapshots,
    settings: zhSettings,
    wizard: zhWizard,
    marketing: zhMarketing,
    superadmin: zhSuperadmin,
    guide: zhGuide,
    profile: zhProfile,
  },
};
