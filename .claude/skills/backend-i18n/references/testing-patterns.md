# Testing Patterns Reference

Comprehensive reference for testing i18n functionality in ServerlessBase backend.

## Test File Organization

```
serverlessbase/packages/server/src/i18n/__tests__/
├── i18n.test.ts                      # Core i18n initialization tests
├── errors.test.ts                    # Error helper function tests
├── zod-error-map.test.ts             # Zod localization tests
├── language-detection.test.ts        # Accept-Language parsing tests
├── language-detection.perf.test.ts   # Performance tests
├── typed-translator.test.ts          # Type-safe translator tests
└── translation-completeness.test.ts  # Translation completeness validation
```

## Running Tests

All test commands must run inside Docker containers:

```bash
# Run all i18n tests
docker exec -it serverless-main-app pnpm test packages/server/src/i18n

# Run specific test file
docker exec -it serverless-main-app pnpm test packages/server/src/i18n/__tests__/errors.test.ts

# Run with watch mode
docker exec -it serverless-main-app pnpm test --watch packages/server/src/i18n

# Run with coverage
docker exec -it serverless-main-app pnpm test --coverage packages/server/src/i18n

# Run only translation completeness check
docker exec -it serverless-main-app pnpm test packages/server/src/i18n/__tests__/translation-completeness.test.ts
```

## Testing Patterns

### Testing Error Helpers

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { TFunction } from 'i18next';
import {
  initI18n,
  getTranslator,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  serviceStartFailedError,
} from '../index';

describe('Error Helpers', () => {
  let t: TFunction;

  beforeAll(async () => {
    await initI18n();
    t = getTranslator('en');
  });

  describe('notFoundError', () => {
    it('should create error without ID', () => {
      const error = notFoundError(t, 'Project');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Project not found');
    });

    it('should create error with ID', () => {
      const error = notFoundError(t, 'Project', 'abc123');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Project with ID abc123 not found');
    });

    it('should work with Arabic translator', async () => {
      const arT = getTranslator('ar');
      const error = notFoundError(arT, 'المشروع');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain('غير موجود');
    });
  });

  describe('unauthorizedError', () => {
    it('should create unauthorized error', () => {
      const error = unauthorizedError(t);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('You must be logged in to perform this action');
    });
  });

  describe('serviceStartFailedError', () => {
    it('should include service name in message', () => {
      const error = serviceStartFailedError(t, 'postgres');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toContain('PostgreSQL database');
      expect(error.message).toContain('start');
    });
  });
});
```

### Testing Zod Integration

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import {
  initI18n,
  getTranslator,
  createZodErrorMap,
  validateWithLocalizedErrors,
  formatZodErrorsWithTranslations,
} from '../index';

describe('Zod Error Map', () => {
  beforeAll(async () => {
    await initI18n();
  });

  describe('string validation', () => {
    it('should translate required error', () => {
      const t = getTranslator('en');
      const schema = z.object({
        name: z.string().min(1),
      });

      const result = validateWithLocalizedErrors(schema, { name: '' }, t);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('This field is required');
      }
    });

    it('should translate minLength error with interpolation', () => {
      const t = getTranslator('en');
      const schema = z.object({
        name: z.string().min(5),
      });

      const result = validateWithLocalizedErrors(schema, { name: 'abc' }, t);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Must be at least 5 characters');
      }
    });

    it('should translate email error', () => {
      const t = getTranslator('en');
      const schema = z.object({
        email: z.string().email(),
      });

      const result = validateWithLocalizedErrors(schema, { email: 'invalid' }, t);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please enter a valid email address');
      }
    });
  });

  describe('custom refinement with i18nKey', () => {
    it('should use custom i18n key from params', () => {
      const t = getTranslator('en');
      const schema = z.string().refine(
        (val) => val.startsWith('test'),
        { params: { i18nKey: 'validation:string.pattern' } }
      );

      const result = validateWithLocalizedErrors(schema, 'invalid', t);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid format');
      }
    });
  });

  describe('formatZodErrorsWithTranslations', () => {
    it('should format errors with field paths', () => {
      const t = getTranslator('en');
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const result = schema.safeParse({ name: '', email: 'invalid' });
      if (!result.success) {
        const formatted = formatZodErrorsWithTranslations(result.error, t);
        expect(formatted.name).toBeDefined();
        expect(formatted.email).toBeDefined();
      }
    });
  });
});
```

### Testing Language Detection

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseAcceptLanguage,
  parseAcceptLanguageHeader,
  isLanguageSupported,
  normalizeLanguage,
  getEffectiveLanguage,
} from '../language-detection';

describe('Language Detection', () => {
  describe('parseAcceptLanguageHeader', () => {
    it('should parse simple header', () => {
      const result = parseAcceptLanguageHeader('en-US,en;q=0.9,ar;q=0.8');
      expect(result).toHaveLength(3);
      expect(result[0].code).toBe('en');
      expect(result[0].region).toBe('US');
      expect(result[0].quality).toBe(1);
    });

    it('should sort by quality descending', () => {
      const result = parseAcceptLanguageHeader('ar;q=0.8,en;q=0.9,fr;q=1');
      expect(result[0].code).toBe('fr');
      expect(result[1].code).toBe('en');
      expect(result[2].code).toBe('ar');
    });

    it('should handle empty header', () => {
      expect(parseAcceptLanguageHeader('')).toEqual([]);
      expect(parseAcceptLanguageHeader(null as any)).toEqual([]);
    });
  });

  describe('parseAcceptLanguage', () => {
    it('should return supported language', () => {
      expect(parseAcceptLanguage('ar,en;q=0.9')).toBe('ar');
      expect(parseAcceptLanguage('fr-FR,en;q=0.9')).toBe('fr');
    });

    it('should fallback to English for unsupported languages', () => {
      expect(parseAcceptLanguage('zh-CN,zh;q=0.9')).toBe('en');
      expect(parseAcceptLanguage('ja')).toBe('en');
    });

    it('should return default for null/undefined', () => {
      expect(parseAcceptLanguage(null)).toBe('en');
      expect(parseAcceptLanguage(undefined)).toBe('en');
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('en')).toBe(true);
      expect(isLanguageSupported('ar')).toBe(true);
      expect(isLanguageSupported('fr')).toBe(true);
      expect(isLanguageSupported('de')).toBe(true);
      expect(isLanguageSupported('es')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('zh')).toBe(false);
      expect(isLanguageSupported('ja')).toBe(false);
      expect(isLanguageSupported('ko')).toBe(false);
    });
  });

  describe('normalizeLanguage', () => {
    it('should extract base code from regional variants', () => {
      expect(normalizeLanguage('en-US')).toBe('en');
      expect(normalizeLanguage('ar-SA')).toBe('ar');
      expect(normalizeLanguage('fr-FR')).toBe('fr');
    });

    it('should lowercase the code', () => {
      expect(normalizeLanguage('EN')).toBe('en');
      expect(normalizeLanguage('AR')).toBe('ar');
    });

    it('should return default for unsupported', () => {
      expect(normalizeLanguage('zh')).toBe('en');
      expect(normalizeLanguage(null)).toBe('en');
    });
  });

  describe('getEffectiveLanguage', () => {
    it('should prioritize user preference', () => {
      const result = getEffectiveLanguage({
        userPreference: 'ar',
        acceptLanguage: 'en',
      });
      expect(result).toBe('ar');
    });

    it('should use Accept-Language when no preference', () => {
      const result = getEffectiveLanguage({
        acceptLanguage: 'fr,en;q=0.9',
      });
      expect(result).toBe('fr');
    });

    it('should return default when nothing provided', () => {
      const result = getEffectiveLanguage({});
      expect(result).toBe('en');
    });
  });
});
```

### Testing Translation Completeness

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SUPPORTED_LANGUAGES, NAMESPACES } from '../index';

describe('Translation Completeness', () => {
  const localesDir = path.join(__dirname, '../locales');

  function loadTranslations(lang: string, namespace: string): Record<string, any> {
    const filePath = path.join(localesDir, lang, `${namespace}.json`);
    if (!fs.existsSync(filePath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  function getAllKeys(obj: Record<string, any>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...getAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  for (const namespace of NAMESPACES) {
    describe(`${namespace} namespace`, () => {
      const englishTranslations = loadTranslations('en', namespace);
      const englishKeys = getAllKeys(englishTranslations);

      it('should have English translations', () => {
        expect(englishKeys.length).toBeGreaterThan(0);
      });

      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === 'en') continue;

        describe(`${lang} language`, () => {
          const translations = loadTranslations(lang, namespace);
          const translationKeys = getAllKeys(translations);

          it('should have all keys from English', () => {
            const missingKeys = englishKeys.filter(
              (key) => !translationKeys.includes(key)
            );
            expect(missingKeys).toEqual([]);
          });

          it('should not have extra keys not in English', () => {
            const extraKeys = translationKeys.filter(
              (key) => !englishKeys.includes(key)
            );
            expect(extraKeys).toEqual([]);
          });
        });
      }
    });
  }

  describe('Interpolation Variables', () => {
    function extractVariables(str: string): string[] {
      const matches = str.match(/{{(\w+)}}/g) || [];
      return matches.map((m) => m.replace(/[{}]/g, ''));
    }

    for (const namespace of NAMESPACES) {
      const englishTranslations = loadTranslations('en', namespace);

      function checkVariables(
        obj: Record<string, any>,
        enObj: Record<string, any>,
        path: string,
        lang: string
      ) {
        for (const key of Object.keys(enObj)) {
          const fullPath = path ? `${path}.${key}` : key;

          if (typeof enObj[key] === 'object') {
            if (obj[key]) {
              checkVariables(obj[key], enObj[key], fullPath, lang);
            }
          } else if (typeof enObj[key] === 'string' && obj[key]) {
            const enVars = extractVariables(enObj[key]);
            const translatedVars = extractVariables(obj[key]);

            const missingVars = enVars.filter((v) => !translatedVars.includes(v));
            const extraVars = translatedVars.filter((v) => !enVars.includes(v));

            if (missingVars.length > 0 || extraVars.length > 0) {
              throw new Error(
                `Variable mismatch in ${lang}/${namespace}/${fullPath}: ` +
                `missing=[${missingVars}], extra=[${extraVars}]`
              );
            }
          }
        }
      }

      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === 'en') continue;

        it(`should have matching variables in ${lang}/${namespace}`, () => {
          const translations = loadTranslations(lang, namespace);
          expect(() => {
            checkVariables(translations, englishTranslations, '', lang);
          }).not.toThrow();
        });
      }
    }
  });
});
```

## Testing tRPC Context Integration

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initI18n, getTranslator, parseAcceptLanguage } from '../index';
import { notFoundError } from '../errors';

describe('tRPC Context Integration', () => {
  beforeAll(async () => {
    await initI18n();
  });

  it('should integrate with tRPC context pattern', () => {
    // Simulate middleware extracting language
    const headers = { 'accept-language': 'ar,en;q=0.9' };
    const language = parseAcceptLanguage(headers['accept-language']);
    const t = getTranslator(language);

    // Simulate context
    const ctx = {
      language,
      t,
    };

    // Use in procedure
    const error = notFoundError(ctx.t, 'مشروع');
    expect(error.message).toContain('غير موجود');
  });

  it('should handle missing Accept-Language header', () => {
    const language = parseAcceptLanguage(undefined);
    expect(language).toBe('en');

    const t = getTranslator(language);
    const error = notFoundError(t, 'Project');
    expect(error.message).toBe('Project not found');
  });
});
```

## Mocking i18n in Tests

For unit tests of components that use i18n:

```typescript
import { vi } from 'vitest';

// Mock the entire i18n module
vi.mock('@dokploy/server/i18n', () => ({
  getTranslator: vi.fn(() => (key: string, params?: Record<string, any>) => {
    // Return key with params for testing
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  }),
  notFoundError: vi.fn((t, resource, id) => ({
    code: 'NOT_FOUND',
    message: id ? `${resource}:${id} not found` : `${resource} not found`,
  })),
  // ... other mocks
}));
```

## Best Practices

1. **Always test with multiple languages** - At minimum test English and Arabic
2. **Test interpolation** - Verify dynamic values are inserted correctly
3. **Test edge cases** - Empty strings, null values, malformed headers
4. **Run completeness tests in CI** - Catch missing translations early
5. **Mock sparingly** - Prefer real translations for integration tests
6. **Test error codes** - Verify tRPC codes match expected values
7. **Test the full flow** - Header parsing → language detection → translation
