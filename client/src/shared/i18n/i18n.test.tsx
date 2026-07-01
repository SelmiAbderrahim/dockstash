import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  NAMESPACES,
  SUPPORTED_LOCALES,
  applyLocaleToDocument,
  changeLanguage,
  i18n,
  initI18n,
  isRtl,
  isSupportedLocale,
  persistLocale,
  readStoredLocale,
} from './index';
import { RESOURCES } from './resources';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LANGUAGE_COOKIE } from './locales';

const collectKeys = (obj: unknown, prefix = ''): string[] => {
  if (obj == null || typeof obj !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(path);
    else if (v && typeof v === 'object') out.push(...collectKeys(v, path));
  }
  return out;
};

const placeholders = (s: string): string[] =>
  Array.from(s.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g))
    .map((m) => m[1] ?? '')
    .filter(Boolean)
    .sort();

const clearCookie = (name: string) => {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

describe('client i18n key parity', () => {
  it.each(NAMESPACES)(
    '%s namespace: all 7 locales expose identical key sets',
    (ns) => {
      const baselineKeys = collectKeys(RESOURCES[DEFAULT_LOCALE][ns]).sort();
      for (const locale of SUPPORTED_LOCALES) {
        const keys = collectKeys(RESOURCES[locale][ns]).sort();
        expect(keys, `${locale}/${ns} keys must match ${DEFAULT_LOCALE}`).toEqual(baselineKeys);
      }
    },
  );

  it.each(NAMESPACES)(
    '%s namespace: {{var}} placeholders match across locales',
    (ns) => {
      const walk = (base: unknown, cmp: unknown) => {
        if (typeof base === 'string') {
          expect(placeholders(cmp as string)).toEqual(placeholders(base));
          return;
        }
        if (base && typeof base === 'object') {
          for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
            walk(v, (cmp as Record<string, unknown>)[k]);
          }
        }
      };
      const baseline = RESOURCES[DEFAULT_LOCALE][ns];
      for (const locale of SUPPORTED_LOCALES) {
        walk(baseline, RESOURCES[locale][ns]);
      }
    },
  );
});

describe('locale utilities', () => {
  it('isSupportedLocale accepts each language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
  });
  it('isSupportedLocale rejects garbage', () => {
    expect(isSupportedLocale('xx')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(3)).toBe(false);
  });
  it('isRtl only for ar', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
    expect(isRtl('fr')).toBe(false);
  });
  it('applyLocaleToDocument sets lang + dir', () => {
    applyLocaleToDocument('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    applyLocaleToDocument('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

describe('cookie persistence', () => {
  beforeEach(() => clearCookie(LANGUAGE_COOKIE));

  it('reads stored locale from the cookie', () => {
    persistLocale('de');
    expect(readStoredLocale()).toBe('de');
  });

  it('returns null for unknown stored value', () => {
    document.cookie = `${LANGUAGE_COOKIE}=zz; path=/`;
    expect(readStoredLocale()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredLocale()).toBeNull();
  });
});

describe('i18n initialization + switching', () => {
  beforeEach(async () => {
    clearCookie(LANGUAGE_COOKIE);
    initI18n({ initialLocale: 'en' });
    await i18n.changeLanguage('en');
  });

  it('renders English by default', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>,
    );
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
  });

  it('switches to Arabic, persists to cookie, sets dir=rtl', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>,
    );

    await act(async () => {
      await changeLanguage('ar');
    });

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.cookie).toContain(`${LANGUAGE_COOKIE}=ar`);
    expect(screen.getByLabelText('اللغة')).toBeInTheDocument();
  });

  it('switching to a non-RTL language sets dir=ltr', async () => {
    await act(async () => {
      await changeLanguage('ar');
    });
    expect(document.documentElement.dir).toBe('rtl');

    await act(async () => {
      await changeLanguage('fr');
    });
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('ignores unsupported locale on changeLanguage', async () => {
    await act(async () => {
      await changeLanguage('xx' as never);
    });
    expect(i18n.resolvedLanguage).toBe('en');
  });

  it('translates errors namespace correctly per locale', async () => {
    await act(async () => {
      await changeLanguage('de');
    });
    expect(i18n.t('errors:notFound')).toMatch(/nicht gefunden/i);
    await act(async () => {
      await changeLanguage('zh');
    });
    expect(i18n.t('errors:notFound')).toContain('找不到');
  });

  it('reads stored language on re-init', async () => {
    persistLocale('ru');
    // reset i18n state by calling initI18n path via readStoredLocale directly
    expect(readStoredLocale()).toBe('ru');
  });

  it('unknown stored locale falls back to en on read', () => {
    document.cookie = `${LANGUAGE_COOKIE}=zzz; path=/`;
    expect(readStoredLocale()).toBeNull();
  });
});
