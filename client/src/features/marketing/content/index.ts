// Public API for the marketing content datasets. Named re-exports only.

export { COMPETITORS, getCompetitor } from './competitors';
export { SERVICE_GUIDES, getServiceGuide, SERVICE_GUIDE_SLUGS } from './guides';
export { USE_CASES, getUseCase, USE_CASE_SLUGS } from './use-cases';
export {
  hashSlug,
  pick,
  guideIntro,
  consistencyNote,
  useCaseIntro,
  altIntro,
} from './transform';
