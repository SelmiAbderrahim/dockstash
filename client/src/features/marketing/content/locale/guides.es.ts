// Spanish guide copy bundle — loaded ONLY via content/copy-registry.ts
// dynamic import (one async chunk per locale; app code must never import
// this module statically).

import type { GuideCopyBundle } from './types';
import { TEMPLATES } from './es/templates';
import { SERVICES } from './es/services';
import { PLATFORM } from './es/platform';

export const GUIDE_COPY: GuideCopyBundle = {
  templates: TEMPLATES,
  services: SERVICES,
  platform: PLATFORM,
};
