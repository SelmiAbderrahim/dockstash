# Firecrawl Integration - WebSmith Reference

## Overview

WebSmith uses the Firecrawl API to scrape websites for clone mode. The API key is stored as a provider type in the existing **AI Assistants settings page** - it is NOT a separate settings section.

## Key Storage

### Provider Type

Firecrawl API key is stored in the `aiProvider` table with `type = 'firecrawl'`:

```typescript
// Query Firecrawl key via existing AI config service
const firecrawlProvider = await db.query.aiProvider.findFirst({
  where: and(
    eq(aiProvider.userId, userId),
    eq(aiProvider.type, 'firecrawl'),
  ),
});

const firecrawlKey = firecrawlProvider?.apiKey;
```

### UI Location

The Firecrawl key is configured alongside other AI providers in:
- **Dashboard > Settings > AI Assistants > Providers**
- Same `add-provider-dialog.tsx` component with `type: 'firecrawl'` option
- Same `provider-card.tsx` for display and management

### FORBIDDEN

```typescript
// WRONG - separate settings section
❌ <FirecrawlSettings />
❌ process.env.FIRECRAWL_API_KEY
❌ await getWebsmithConfig('firecrawlKey')

// CORRECT - via existing AI provider system
✅ await getAiProviderKey(userId, 'firecrawl')
```

## Firecrawl SDK Usage

### Installation

```bash
# Already listed in serverlessbase dependencies
npm install @mendable/firecrawl-js
```

### Scraping Service

```typescript
// serverlessbase/packages/server/src/services/websmith/scraping-service.ts
import FirecrawlApp from '@mendable/firecrawl-js';

export class ScrapingService {
  private getClient(apiKey: string): FirecrawlApp {
    return new FirecrawlApp({ apiKey });
  }

  async scrapeUrl(userId: string, url: string): Promise<ScrapeResult> {
    // 1. Get Firecrawl API key from provider settings
    const apiKey = await getAiProviderKey(userId, 'firecrawl');
    if (!apiKey) {
      throw new Error('Firecrawl API key not configured. Add it in Settings > AI Assistants.');
    }

    // 2. Initialize client
    const client = this.getClient(apiKey);

    // 3. Scrape the URL
    const result = await client.scrapeUrl(url, {
      formats: ['html', 'screenshot'],
      includeTags: ['head', 'body'],
      waitFor: 3000, // Wait for dynamic content
    });

    if (!result.success) {
      throw new Error(`Failed to scrape ${url}: ${result.error}`);
    }

    // 4. Extract structured data
    return {
      html: result.html || '',
      css: this.extractStylesheets(result.html || ''),
      metadata: {
        title: result.metadata?.title || '',
        description: result.metadata?.description || '',
        favicon: result.metadata?.favicon || '',
        ogImage: result.metadata?.ogImage || '',
      },
      screenshot: result.screenshot || '',
      links: this.extractLinks(result.html || '', url),
    };
  }

  private extractStylesheets(html: string): string[] {
    const styles: string[] = [];

    // Extract inline styles
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    while ((match = styleRegex.exec(html)) !== null) {
      styles.push(match[1].trim());
    }

    return styles;
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /href=["']([^"']+)["']/gi;
    const base = new URL(baseUrl);

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const url = new URL(match[1], base);
        if (url.hostname === base.hostname) {
          links.push(url.href);
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return [...new Set(links)];
  }
}
```

## Scrape Result Type

```typescript
interface ScrapeResult {
  /** Full page HTML content */
  html: string;

  /** Extracted CSS stylesheets (inline styles) */
  css: string[];

  /** Page metadata */
  metadata: {
    /** Page title from <title> tag */
    title: string;
    /** Meta description */
    description: string;
    /** Favicon URL */
    favicon: string;
    /** Open Graph image URL */
    ogImage: string;
  };

  /** Base64-encoded full page screenshot */
  screenshot: string;

  /** Internal links found on the page */
  links: string[];
}
```

## tRPC Procedure

```typescript
// In websmith router
'scrape.url': protectedProcedure
  .input(z.object({
    url: z.string().url('Invalid URL format'),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Check usage limits
    const limits = await checkUsageLimits(ctx.user.id);
    if (!limits.allowed) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: ctx.t('websmith:errors.usageLimitReached'),
      });
    }

    // 2. Validate URL
    const url = new URL(input.url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: ctx.t('websmith:errors.invalidProtocol'),
      });
    }

    // 3. Scrape
    const scrapingService = new ScrapingService();
    const result = await scrapingService.scrapeUrl(ctx.user.id, input.url);

    // 4. Record usage
    await recordUsage(ctx.user.id, {
      type: 'scrape',
      url: input.url,
    });

    return result;
  }),
```

## URL Validation

### Allowed URLs

```typescript
function validateScrapeUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' };
    }

    // Block localhost and private IPs
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return { valid: false, error: 'Cannot scrape local or private URLs' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

## Error Handling

| Error | Cause | User Message |
|-------|-------|-------------|
| No API key | Firecrawl not configured | "Please add your Firecrawl API key in Settings > AI Assistants" |
| 401 Unauthorized | Invalid API key | "Firecrawl API key is invalid. Please check Settings > AI Assistants" |
| 429 Rate Limited | Too many requests | "Rate limited by Firecrawl. Please wait and try again" |
| Scrape failed | Site blocks scraping | "Unable to scrape this website. The site may block automated access" |
| Timeout | Site too slow | "The website took too long to respond. Please try again" |

## Usage Tracking

Each scrape operation is recorded:

```typescript
await db.update(websmithUsage)
  .set({
    pagesCloned: sql`${websmithUsage.pagesCloned} + 1`,
    lastScrapedAt: new Date(),
  })
  .where(eq(websmithUsage.userId, userId));
```

## Frontend Integration

### URL Input Component

```typescript
// client/src/components/dashboard/websmith/url-input.tsx
export function UrlInput({ onScrape }: { onScrape: (result: ScrapeResult) => void }) {
  const [url, setUrl] = useState('');
  const scrapeMutation = useScrapeUrl();

  const handleScrape = async () => {
    const result = await scrapeMutation.mutateAsync({ url });
    onScrape(result);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        className="flex-1"
      />
      <Button
        onClick={handleScrape}
        disabled={!url || scrapeMutation.isPending}
        className="min-w-[44px]"
      >
        {scrapeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clone'}
      </Button>
    </div>
  );
}
```

### React Query Hook

```typescript
// client/src/hooks/websmith/useScrapeUrl.ts
export function useScrapeUrl() {
  return useMutation({
    mutationFn: (data: { url: string }) => WebsmithService.scrapeUrl(data.url),
    onError: (error) => {
      toast.error(error.message || 'Failed to scrape URL');
    },
  });
}
```
