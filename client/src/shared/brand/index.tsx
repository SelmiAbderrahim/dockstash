import type { CSSProperties } from 'react';
import { cn } from '@shared/lib/utils';

export const BRAND_NAME = 'Dockstash';
export const BRAND_TAGLINE = 'One-click, verified backups for any Docker project.';
export const BRAND_SOCIAL_HANDLE = '@dockstash';
export const BRAND_THEME_COLOR = '#111113';
export const BRAND_PRIMARY_COLOR = BRAND_THEME_COLOR;

export const BRAND_ASSETS = {
  favicon: '/favicon.svg',
  manifest: '/site.webmanifest',
  maskIcon: '/safari-pinned-tab.svg',
  mark: '/brand/dockstash-mark.svg',
  logo: '/brand/dockstash-logo.svg',
  appleTouchIcon: '/apple-touch-icon.png',
  favicon16: '/icons/favicon-16.png',
  favicon32: '/icons/favicon-32.png',
  icon192: '/icons/icon-192.png',
  icon512: '/icons/icon-512.png',
  maskableIcon512: '/icons/maskable-512.png',
  ogDefault: '/og/default.png',
  ogLogo: '/og/logo.png',
} as const;

interface BrandLogoProps {
  className?: string;
  markOnly?: boolean;
  style?: CSSProperties;
}

export const BrandLogo = ({ className, markOnly = false, style }: BrandLogoProps) => (
  <span
    className={cn(
      'brand-logo inline-flex items-center gap-2 leading-none whitespace-nowrap text-inherit no-underline',
      className,
    )}
    style={style}
    aria-label={markOnly ? BRAND_NAME : undefined}
    role={markOnly ? 'img' : undefined}
  >
    <svg
      className="brand-logo__mark size-8 shrink-0"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <rect x="13" y="13" width="38" height="10" rx="3" fill="var(--background)" />
      <rect x="13" y="27" width="38" height="10" rx="3" fill="var(--muted)" />
      <rect x="13" y="41" width="38" height="10" rx="3" fill="var(--background)" />
      <path
        d="M20 18h19M20 32h15M20 46h13"
        stroke="currentColor"
        strokeOpacity="0.56"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="49" cy="46.5" r="9.5" fill="var(--background)" />
      <path
        d="m44.5 46.7 3 3 6.8-7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    {!markOnly && (
      <span className="brand-logo__text text-lg font-bold tracking-normal">
        {BRAND_NAME}
      </span>
    )}
  </span>
);
