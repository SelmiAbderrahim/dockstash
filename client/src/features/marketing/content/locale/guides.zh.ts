// Chinese guide copy bundle — loaded ONLY via content/copy-registry.ts
// dynamic import (one async chunk per locale; app code must never import
// this module statically).

import type { GuideCopyBundle } from './types';
import { TEMPLATES } from './zh/templates';
import { SERVICES } from './zh/services';
import { PLATFORM } from './zh/platform';

export const GUIDE_COPY: GuideCopyBundle = {
  templates: TEMPLATES,
  services: SERVICES,
  platform: PLATFORM,
};
