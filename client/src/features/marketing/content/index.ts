// Public API for the marketing content datasets. Named re-exports only.

export { COMPETITORS, getCompetitor } from './competitors';
export { SERVICE_GUIDES, getServiceGuide, SERVICE_GUIDE_SLUGS } from './guides';
export {
  PLATFORM_GUIDES,
  getPlatformGuide,
  PLATFORM_GUIDE_SLUGS,
} from './platform-guides';
export { USE_CASES, getUseCase, USE_CASE_SLUGS } from './use-cases';
export {
  hashSlug,
  pick,
  fill,
  guideIntro,
  consistencyNote,
  useCaseIntro,
  altIntro,
} from './transform';
export {
  isGuidePath,
  hasGuideCopy,
  getGuideCopy,
  loadGuideCopy,
  __resetGuideCopyForTests,
} from './copy-registry';
export { useGuideCopy } from './useGuideCopy';
export type {
  GuideCopyBundle,
  ServiceGuideCopy,
  PlatformGuideCopy,
  GuideStepCopy,
  TemplateBank,
  TroubleshootingItem,
} from './locale/types';
