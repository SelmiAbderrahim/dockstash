// Semantic-transformation layer — deterministic, slug-seeded prose generation.
//
// WHY THIS EXISTS
// Programmatic pages (one per service, per use-case, per competitor) risk
// being near-duplicates that differ only by a swapped noun. AI answer engines
// and search engines penalize that. Instead of template variable-swapping,
// these pure functions rotate between several genuinely different sentence
// structures and openers, choosing the variant from a deterministic hash of
// the page's slug.
//
// The result: the SAME slug always renders the SAME prose (stable across
// builds, SSR-safe, snapshot-testable), but DIFFERENT slugs pick DIFFERENT
// structures — so the corpus is majority-unique by construction. There is NO
// Math.random and NO Date here: output depends only on the input data.

import type { Competitor, ServiceGuide, UseCaseApp } from '../types';
import type { GuideCopyBundle } from './locale/types';

/**
 * Small deterministic string hash (FNV-1a style). Stable across runs and
 * platforms — the same string always maps to the same non-negative number.
 */
export function hashSlug(slug: string): number {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    // 32-bit FNV prime multiply, kept in unsigned range.
    hash = Math.imul(hash, 16777619);
  }
  // Fold to a non-negative 31-bit integer.
  return (hash >>> 0) & 0x7fffffff;
}

/**
 * Deterministically pick one option from a list, seeded by the slug (and an
 * optional salt so several independent picks on the same slug can diverge).
 * The same (slug, salt) always yields the same choice.
 */
export function pick<T>(slug: string, options: T[], salt = 0): T {
  if (options.length === 0) {
    throw new Error('pick() requires a non-empty options array');
  }
  const seed = hashSlug(`${slug}::${salt}`);
  return options[seed % options.length]!;
}

/** Join a list of names into readable prose: "a, b and c". */
function humanJoin(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0]!;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

/**
 * Interpolate a copy-bundle template. Slots are `{{name}}`-style; every slot
 * present in the template MUST resolve — an unresolved slot throws so a typo
 * in a locale bundle fails tests instead of shipping "{{name}}" to a page.
 */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`Unresolved template slot {{${key}}}`);
    }
    return value;
  });
}

/**
 * Answer-first intro for a service backup guide (40–60 words). Rotates between
 * the locale's five opener structures seeded by the guide slug, and always
 * states the dump command plus the "don't copy live files" rule in the
 * service's own terms. Sentence banks live in the per-locale copy bundle;
 * commands and paths interpolate untranslated.
 */
export function guideIntro(guide: ServiceGuide, copy: GuideCopyBundle): string {
  const consistency = consistencyNote(guide, copy);
  const template = pick(guide.slug, copy.templates.intro);
  return fill(template, {
    name: guide.serviceName,
    cmd: guide.dumpCmd,
    livePath: guide.liveDataPaths[0] ?? 'the live data directory',
    alias: guide.aliases[0] ?? guide.serviceName,
    consistency,
    consistencyLower: lowerFirst(consistency),
  });
}

/**
 * Service-specific consistency explanation, localized. The sentence describes
 * the real mechanism (Postgres MVCC snapshot vs MySQL single-transaction vs
 * Mongo oplog vs Redis RDB vs SQLite WAL, etc.), not a generic line. Falls
 * back to the guide's own (English) consistencyNote fact for a slug missing
 * from the bundle — content tests keep that branch unreachable for shipped
 * guides.
 */
export function consistencyNote(guide: ServiceGuide, copy: GuideCopyBundle): string {
  return copy.templates.consistency[guide.slug] ?? guide.consistencyNote;
}

/**
 * Answer-first intro for a use-case (per-app) backup page (40–60 words).
 * Names the app's databases and data volumes and states the three-part plan:
 * dump each DB, capture the volumes, capture compose/.env. Seeded by slug.
 */
export function useCaseIntro(app: UseCaseApp): string {
  const name = app.appName;
  const dbs = humanJoin(app.detectedDbs.map(prettyDbName));
  const volumeCount = app.detectedVolumes.length;
  const volumeWord = volumeCount === 1 ? 'volume' : 'volumes';
  const dbPhrase = app.detectedDbs.length === 1 ? `its ${dbs} database` : `its ${dbs} databases`;

  const templates = [
    `A complete ${name} backup has three parts: dump ${dbPhrase} the correct way, capture the ${volumeCount} data ${volumeWord} that hold files on disk, and save the compose file and .env. Dockstash detects all three automatically, dumps the database from the running container, and restics everything off-site.`,
    `To back up ${name} in Docker you cannot just dump the database — you also need the app's data ${volumeWord} and its config. Dockstash dumps ${dbPhrase} consistently, captures the ${volumeCount} ${volumeWord} of on-disk data, and snapshots docker-compose.yml plus .env in one encrypted run.`,
    `${name} spreads its state across ${dbPhrase} and ${volumeCount} data ${volumeWord} on disk, plus compose and .env config. A backup that skips any layer will not restore cleanly. Dockstash auto-detects each layer, dumps the database from inside the container, and stores the lot off-site with restic.`,
    `Backing up ${name} means capturing three layers at once: a consistent dump of ${dbPhrase}, the ${volumeCount} data ${volumeWord} where files live, and the compose/.env config. Dockstash scans the stack, runs the right dump command, and restics every layer to your storage VPS.`,
  ];

  return pick(app.slug, templates);
}

/** Map a guide slug to a display DB name for use-case prose. */
function prettyDbName(dbSlug: string): string {
  const names: Record<string, string> = {
    postgres: 'PostgreSQL',
    mysql: 'MySQL',
    mariadb: 'MariaDB',
    mongodb: 'MongoDB',
    redis: 'Redis',
    valkey: 'Valkey',
    sqlite: 'SQLite',
    clickhouse: 'ClickHouse',
    elasticsearch: 'Elasticsearch',
    rabbitmq: 'RabbitMQ',
    minio: 'MinIO',
    influxdb: 'InfluxDB',
    neo4j: 'Neo4j',
  };
  return names[dbSlug] ?? dbSlug;
}

/**
 * Answer-first intro for a competitor alternative page (40–60 words). Rotates
 * openers seeded by competitor slug and leads with the honest positioning:
 * what the competitor is good at, and where Dockstash's Docker-awareness wins.
 */
export function altIntro(competitor: Competitor): string {
  const name = competitor.name;

  const templates = [
    `${name} is a solid choice for what it does — ${competitor.category.toLowerCase()}. Where Dockstash differs is Docker-project awareness: it auto-detects your Compose stack, dumps each database the correct way from the running container, and drill-tests the restore. ${competitor.switchIf}`,
    `Comparing Dockstash and ${name}? ${name} handles ${competitor.category.toLowerCase()} well, and we say so honestly. Dockstash's edge is that it understands your Docker project — consistent DB dumps, Compose and reverse-proxy detection, and automated restore drills. Switch if ${lowerFirst(competitor.switchIf)}`,
    `${name} (${competitor.category.toLowerCase()}) and Dockstash overlap, but solve backup at different layers. ${name} backs up generically; Dockstash knows a Postgres container needs a pg_dumpall, not a file copy, detects your whole Compose stack, and proves the restore works before you need it.`,
    `Looking for a ${name} alternative? Be clear-eyed: ${name} is genuinely good at ${competitor.category.toLowerCase()}. Dockstash wins when your backups are Dockerized — Docker-aware database adapters, automatic stack detection, restore-drill verification, and loud failure alerts. ${competitor.switchIf}`,
  ];

  return pick(competitor.slug, templates);
}

/** Lowercase the first character (for mid-sentence insertion). */
function lowerFirst(text: string): string {
  return text.length > 0 ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}
