// English guide copy bundle — loaded ONLY via content/copy-registry.ts
// dynamic import (one async chunk per locale; app code must never import
// this module statically).

import type { GuideCopyBundle } from './types';
import { TEMPLATES } from './en/templates';
import { SERVICES } from './en/services';
import { PLATFORM } from './en/platform';

export const GUIDE_COPY: GuideCopyBundle = {
  templates: TEMPLATES,
  services: SERVICES,
  platform: PLATFORM,
};
