import type { CSSProperties } from 'react';
import { cn } from '@shared/lib/utils';

export const BRAND_NAME = 'Dockstash';
export const BRAND_TAGLINE = 'One-click, verified backups for any Docker project.';
export const BRAND_SOCIAL_HANDLE = '@dockstash';
export const BRAND_THEME_COLOR = '#0f1113';
export const BRAND_PRIMARY_COLOR = '#2f6fed';

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
      <rect width="64" height="64" rx="14" fill="#0f1113" />
      <path
        d="M13 16a4 4 0 0 1 4-4h25a7 7 0 0 1 7 7v18H17a4 4 0 0 1-4-4V16Z"
        fill="#2f6fed"
      />
      <path
        d="M18 20h22M18 27h22M18 34h13"
        stroke="#0f1113"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <rect x="22" y="33" width="29" height="9" rx="3.5" fill="#f8fafc" />
      <rect x="22" y="43" width="29" height="9" rx="3.5" fill="#f8fafc" />
      <path
        d="M27 42h19M27 52h15"
        stroke="#0f1113"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="49" cy="48" r="8.5" fill="#62dca5" />
      <path
        d="m45 48 3 3 6-7"
        fill="none"
        stroke="#0f1113"
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
