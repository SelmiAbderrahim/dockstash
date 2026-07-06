// Russian guide copy bundle — loaded ONLY via content/copy-registry.ts
// dynamic import (one async chunk per locale; app code must never import
// this module statically).

import type { GuideCopyBundle } from './types';
import { TEMPLATES } from './ru/templates';
import { SERVICES } from './ru/services';
import { PLATFORM } from './ru/platform';

export const GUIDE_COPY: GuideCopyBundle = {
  templates: TEMPLATES,
  services: SERVICES,
  platform: PLATFORM,
};
