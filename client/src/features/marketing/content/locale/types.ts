// Per-locale guide copy bundle — the localized prose layer for the /guides
// surface. Universal facts (slugs, commands, ports, paths) live in
// content/guides.ts and content/platform-guides.ts; every sentence a visitor
// reads lives here, one bundle per locale, loaded lazily via
// content/copy-registry.ts (never statically imported by app code, so each
// locale ships as its own async chunk).
//
// The TypeScript shapes below are the parity contract: a locale bundle that
// misses a slug, a step id, or a field fails typecheck and the
// guide-copy content tests.

import type { FaqItem } from '../../types';

/** Localized title/body for one walkthrough or restore step, keyed by step id. */
export interface GuideStepCopy {
  title: string;
  body: string;
}

/** One troubleshooting row: what the user sees, why, and the fix. */
export interface TroubleshootingItem {
  symptom: string;
  cause: string;
  fix: string;
}

/**
 * Localized sentence banks for the deterministic prose generator
 * (content/transform.ts). Templates carry {{slot}} placeholders that are
 * interpolated with universal facts — commands and paths stay untranslated.
 */
export interface TemplateBank {
  /**
   * Intro sentence templates (5 per locale — bank lengths must match across
   * locales so slug-seeded rotation picks the same structure everywhere).
   * Slots: {{name}}, {{cmd}}, {{livePath}}, {{alias}}, {{consistency}},
   * {{consistencyLower}}.
   */
  intro: string[];
  /** Per-engine consistency sentence, keyed by service guide slug. */
  consistency: Record<string, string>;
}

/** Localized prose for one database service guide. */
export interface ServiceGuideCopy {
  /** Keyed by ServiceGuide.walkthrough step id. */
  walkthrough: Record<string, GuideStepCopy>;
  /** Restore-and-verify section: lead-in paragraph + steps keyed by id. */
  restoreVerify: {
    intro: string;
    steps: Record<string, GuideStepCopy>;
  };
  /** At least 3 symptom/cause/fix rows. */
  troubleshooting: TroubleshootingItem[];
  /** Service-specific warnings ("why live-copy fails"). */
  gotchas: string[];
  /** 6–8 questions, rendered into FAQPage JSON-LD. */
  faq: FaqItem[];
}

/** Localized prose for one platform guide. */
export interface PlatformGuideCopy {
  /** Answer-first lead paragraph (AEO extract target). */
  intro: string;
  /** Keyed by PlatformGuide.steps step id. */
  steps: Record<string, GuideStepCopy>;
  /** 4–6 questions, rendered into FAQPage JSON-LD. */
  faq: FaqItem[];
}

/** The full copy bundle one locale ships. */
export interface GuideCopyBundle {
  templates: TemplateBank;
  /** Keyed by service guide slug — must cover every SERVICE_GUIDE_SLUGS entry. */
  services: Record<string, ServiceGuideCopy>;
  /** Keyed by platform guide slug — must cover every PLATFORM_GUIDE_SLUGS entry. */
  platform: Record<string, PlatformGuideCopy>;
}
