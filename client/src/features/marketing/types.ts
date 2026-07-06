// Public marketing surface — domain types.
// These are the data contracts shared by the content datasets
// (content/*.ts), the page components, and the SEO/sitemap layer.
// Everything here is plain data (no React) so it is safe to import
// on the server (SSR + sitemap generation).

/** A frequently-asked question rendered into FAQPage JSON-LD. */
export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * One step in a guide walkthrough. The step is a locale-independent skeleton:
 * `id` keys into the per-locale copy bundle for the translated title/body,
 * and `cmd` (when present) is a universal shell command rendered verbatim
 * in a CodeBlock — commands are never translated.
 */
export interface GuideStep {
  id: string;
  cmd?: string;
}

/** Rows for a side-by-side comparison table on competitor pages. */
export interface ComparisonRow {
  /** Feature / dimension being compared, e.g. "Docker-aware DB dumps". */
  feature: string;
  /** How Dockstash does on this row. */
  dockstash: string;
  /** How the competitor does on this row. */
  competitor: string;
  /** true when Dockstash is the clear winner on this row (drives emphasis). */
  dockstashWins?: boolean;
}

/**
 * A competitor record — single source of truth for every page that
 * references this competitor (alternative page, vs page, hub matrix).
 * Keep strengths honest: real competitor wins build trust + avoid the
 * "biased comparison" penalty AI engines apply.
 */
export interface Competitor {
  /** URL slug, e.g. "backrest". */
  slug: string;
  /** Display name, e.g. "Backrest". */
  name: string;
  /** One-line category, e.g. "Open-source restic web UI". */
  category: string;
  /** 40–60 word answer-first positioning paragraph (AEO extract target). */
  positioning: string;
  /** Pricing summary, e.g. "Free / open-source". */
  pricing: string;
  /** Honest competitor strengths — where they genuinely win. */
  strengths: string[];
  /** Competitor weaknesses Dockstash addresses. */
  weaknesses: string[];
  /** Who the competitor is the right choice for. */
  bestFor: string;
  /** Who should switch to Dockstash instead. */
  switchIf: string;
  /** Side-by-side rows for the comparison matrix. */
  comparison: ComparisonRow[];
  /** Notes on migrating off the competitor onto Dockstash. */
  migrationNotes: string;
  /** Page-specific FAQ (switching objections). */
  faq: FaqItem[];
  /** ISO month the record was last verified, e.g. "2026-07" (recency signal). */
  lastReviewed: string;
}

/**
 * A per-service backup guide (programmatic — /guides/backup-<slug>-docker).
 * Every field maps to the real Dockstash adapter so pages are
 * structurally unique (clears the 60–70% unique-content bar by
 * construction, not variable-swapping).
 */
export interface ServiceGuide {
  /** URL slug, e.g. "postgres". */
  slug: string;
  /** Display name, e.g. "PostgreSQL". */
  serviceName: string;
  /** Alternate names for prose variation, e.g. ["Postgres", "psql"]. */
  aliases: string[];
  /** Example Docker images this matches, e.g. ["postgres:16-alpine"]. */
  dockerImages: string[];
  /** Consistent dump command run inside the container. */
  dumpCmd: string;
  /** Restore command. */
  restoreCmd: string;
  /** Consistency flag/technique note, e.g. "--single-transaction". */
  consistencyNote: string;
  /** Default container port (context only). */
  defaultPort: number;
  /** Env keys Dockstash detects to build the dump, e.g. ["POSTGRES_USER"]. */
  envKeysDetected: string[];
  /** On-disk data paths that must NOT be backed up live. */
  liveDataPaths: string[];
  /**
   * Beginner walkthrough skeleton (8–10 steps). Step ids key into the
   * per-locale copy bundle (ServiceGuideCopy.walkthrough); optional cmds are
   * universal. Prose (titles/bodies/gotchas/FAQ) lives in the copy bundles,
   * not here.
   */
  walkthrough: GuideStep[];
  /** Restore-and-verify skeleton (3–4 steps), same id/cmd contract. */
  restoreVerify: GuideStep[];
  /** Related service guide slugs (same-silo lateral links). */
  relatedServices: string[];
  /** Related use-case slugs that use this service. */
  relatedUseCases: string[];
  /** ISO month last reviewed (recency signal). */
  lastReviewed: string;
}

/**
 * A platform guide (programmatic — /guides/<slug>). Covers using Dockstash
 * itself (connect an agent, schedule backups, restore, drills, …) rather
 * than a specific database engine. Locale-independent skeleton only: all
 * prose lives in the per-locale copy bundles; titles/descriptions live in
 * the `marketing` i18n namespace under `guides.platform.<slug>`.
 */
export interface PlatformGuide {
  /** URL slug, e.g. "connect-fleet-agent". Must never match /^backup-.*-docker$/. */
  slug: string;
  /** Ordered step skeleton; ids key into PlatformGuideCopy.steps. */
  steps: GuideStep[];
  /** Related platform guide slugs. */
  relatedPlatformGuides: string[];
  /** Related service guide slugs. */
  relatedServices: string[];
  /** ISO month last reviewed (recency signal). */
  lastReviewed: string;
}

/** One step in a use-case backup plan (rendered as HowTo steps). */
export interface BackupPlanStep {
  title: string;
  detail: string;
}

/**
 * A per-app use-case backup page (programmatic — /backup/<slug>-docker).
 * Composes ServiceGuide slugs with app-specific volumes/config.
 */
export interface UseCaseApp {
  /** URL slug, e.g. "wordpress". */
  slug: string;
  /** Display name, e.g. "WordPress". */
  appName: string;
  /** Category, e.g. "CMS". */
  category: string;
  /** Compose service images typically present, e.g. ["wordpress", "mysql"]. */
  composeServices: string[];
  /** ServiceGuide slugs this app depends on, e.g. ["mysql"]. */
  detectedDbs: string[];
  /** Named volumes / bind mounts that hold app data. */
  detectedVolumes: string[];
  /** Config paths worth capturing, e.g. ["wp-content", "/etc/traefik"]. */
  configPaths: string[];
  /** Ordered backup plan (empty ⇒ page is noindex'd). */
  backupPlan: BackupPlanStep[];
  /** Restore-specific notes. */
  restoreNotes: string;
  /** Page FAQ. */
  faq: FaqItem[];
  /** Related service guide slugs. */
  relatedGuides: string[];
  /** ISO month last reviewed. */
  lastReviewed: string;
}
