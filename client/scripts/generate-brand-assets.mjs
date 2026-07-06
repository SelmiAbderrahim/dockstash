import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../public/', import.meta.url);

const BRAND = {
  name: 'Dockstash',
  tagline: 'One-click, verified backups for any Docker project.',
  headlineLines: ['Docker backups that', 'prove they restore'],
  subheadLines: [
    'Encrypted Restic snapshots. One-click restore.',
    'Scheduled restore drills for every project.',
  ],
};

const COLORS = {
  ink: '#111113',
  paper: '#f7f7f8',
  muted: '#d9d9dc',
  mutedText: '#b8b8bd',
};

const markShapes = `
  <rect width="64" height="64" rx="14" fill="${COLORS.ink}"/>
  <rect x="13" y="13" width="38" height="10" rx="3" fill="${COLORS.paper}"/>
  <rect x="13" y="27" width="38" height="10" rx="3" fill="${COLORS.muted}"/>
  <rect x="13" y="41" width="38" height="10" rx="3" fill="${COLORS.paper}"/>
  <path d="M20 18h19M20 32h15M20 46h13" stroke="${COLORS.ink}" stroke-opacity=".56" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="49" cy="46.5" r="9.5" fill="${COLORS.paper}"/>
  <path d="m44.5 46.7 3 3 6.8-7.2" fill="none" stroke="${COLORS.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
`;

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
${markShapes}
</svg>
`;

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 246 64" role="img" aria-labelledby="title">
  <title id="title">${BRAND.name}</title>
${markShapes}
  <text x="78" y="42" fill="${COLORS.ink}" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="30" font-weight="750">${BRAND.name}</text>
</svg>
`;

const safariMaskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="13" y="13" width="38" height="10" rx="3"/>
  <rect x="13" y="27" width="38" height="10" rx="3"/>
  <rect x="13" y="41" width="38" height="10" rx="3"/>
  <circle cx="49" cy="46.5" r="9.5"/>
</svg>
`;

function pathFor(relativePath) {
  return new URL(relativePath, ROOT);
}

function writeText(relativePath, content) {
  const url = pathFor(relativePath);
  mkdirSync(dirname(url.pathname), { recursive: true });
  writeFileSync(url, content);
}

async function writePng(relativePath, svg, width, height = width, options = {}) {
  const url = pathFor(relativePath);
  mkdirSync(dirname(url.pathname), { recursive: true });
  let image = sharp(Buffer.from(svg)).resize(width, height);
  if (options.flatten) {
    image = image.flatten({ background: COLORS.ink });
  }
  await image.png().toFile(url.pathname);
}

function manifestJson() {
  return `${JSON.stringify(
    {
      name: BRAND.name,
      short_name: BRAND.name,
      description: BRAND.tagline,
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      theme_color: COLORS.ink,
      background_color: COLORS.ink,
      display: 'standalone',
    },
    null,
    2,
  )}\n`;
}

function maskableIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${COLORS.ink}"/>
  <g transform="translate(96 96) scale(5)">
    <rect x="13" y="13" width="38" height="10" rx="3" fill="${COLORS.paper}"/>
    <rect x="13" y="27" width="38" height="10" rx="3" fill="${COLORS.muted}"/>
    <rect x="13" y="41" width="38" height="10" rx="3" fill="${COLORS.paper}"/>
    <path d="M20 18h19M20 32h15M20 46h13" stroke="${COLORS.ink}" stroke-opacity=".56" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="49" cy="46.5" r="9.5" fill="${COLORS.paper}"/>
    <path d="m44.5 46.7 3 3 6.8-7.2" fill="none" stroke="${COLORS.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;
}

function ogDefaultSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${COLORS.paper}" opacity=".12"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="${COLORS.ink}"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <g transform="translate(72 70)">
    <g transform="scale(1)">
${markShapes}
    </g>
    <text x="84" y="43" fill="${COLORS.paper}" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="34" font-weight="750">${BRAND.name}</text>
  </g>
  <g transform="translate(72 180)">
    <text x="0" y="0" fill="${COLORS.paper}" font-family="Inter, DejaVu Sans, system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" font-weight="760">
      <tspan x="0" dy="0">${BRAND.headlineLines[0]}</tspan>
      <tspan x="0" dy="84">${BRAND.headlineLines[1]}</tspan>
    </text>
    <text x="0" y="210" fill="${COLORS.mutedText}" font-family="Inter, DejaVu Sans, system-ui, -apple-system, Segoe UI, sans-serif" font-size="31" font-weight="500">
      <tspan x="0" dy="0">${BRAND.subheadLines[0]}</tspan>
      <tspan x="0" dy="46">${BRAND.subheadLines[1]}</tspan>
    </text>
  </g>
  <g transform="translate(742 122)">
    <rect x="0" y="0" width="320" height="86" rx="18" fill="none" stroke="${COLORS.paper}" stroke-width="5"/>
    <rect x="34" y="27" width="130" height="8" rx="4" fill="${COLORS.paper}" opacity=".9"/>
    <rect x="34" y="51" width="88" height="8" rx="4" fill="${COLORS.muted}" opacity=".9"/>
    <rect x="0" y="118" width="320" height="86" rx="18" fill="none" stroke="${COLORS.muted}" stroke-width="5"/>
    <rect x="34" y="145" width="142" height="8" rx="4" fill="${COLORS.paper}" opacity=".9"/>
    <rect x="34" y="169" width="96" height="8" rx="4" fill="${COLORS.muted}" opacity=".9"/>
    <rect x="0" y="236" width="320" height="86" rx="18" fill="none" stroke="${COLORS.paper}" stroke-width="5"/>
    <rect x="34" y="263" width="118" height="8" rx="4" fill="${COLORS.paper}" opacity=".9"/>
    <rect x="34" y="287" width="74" height="8" rx="4" fill="${COLORS.muted}" opacity=".9"/>
    <circle cx="306" cy="308" r="64" fill="${COLORS.paper}"/>
    <path d="m275 309 22 22 47-52" fill="none" stroke="${COLORS.ink}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M355 98c50 42 72 97 63 164" fill="none" stroke="${COLORS.muted}" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 18"/>
  </g>
</svg>
`;
}

writeText('brand/dockstash-mark.svg', markSvg);
writeText('brand/dockstash-logo.svg', logoSvg);
writeText('favicon.svg', markSvg);
writeText('safari-pinned-tab.svg', safariMaskSvg);
writeText('site.webmanifest', manifestJson());

await writePng('icons/favicon-16.png', markSvg, 16);
await writePng('icons/favicon-32.png', markSvg, 32);
await writePng('icons/icon-192.png', markSvg, 192);
await writePng('icons/icon-512.png', markSvg, 512);
await writePng('icons/maskable-512.png', maskableIconSvg(), 512, 512, { flatten: true });
await writePng('apple-touch-icon.png', markSvg, 180);
await writePng('og/logo.png', markSvg, 512);
await writePng('og/default.png', ogDefaultSvg(), 1200, 630, { flatten: true });
