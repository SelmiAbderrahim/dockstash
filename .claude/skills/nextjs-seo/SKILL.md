---
name: nextjs-seo
description: |
  Comprehensive SEO implementation guide for Next.js 15 App Router applications. Covers Metadata API, JSON-LD structured data, Open Graph, XML sitemaps, robots.txt, and Core Web Vitals optimization. Use when implementing SEO features or optimizing search rankings.
license: MIT
metadata:
  version: "1.0.0"
  category: "seo"
  dependencies: "next, schema-dts, next-sitemap"
---

# Next.js SEO Implementation Skill

This skill provides comprehensive guidance for implementing SEO in Next.js 15 App Router applications.

## When to Use This Skill

Use this skill when:
- Setting up metadata for new pages
- Implementing structured data (JSON-LD)
- Configuring sitemaps and robots.txt
- Optimizing Core Web Vitals
- Adding Open Graph and Twitter Cards

## Quick Reference

### Metadata API

```typescript
// Static metadata
export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};

// Dynamic metadata
export async function generateMetadata({ params }): Promise<Metadata> {
  const data = await fetchData(params.id);
  return { title: data.title };
}
```

### JSON-LD Structured Data

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "Article Title",
  datePublished: "2024-01-01",
};

<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

### Sitemap

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: "https://example.com", lastModified: new Date() },
  ];
}
```

## Reference Files

- `references/metadata-api.md` - Complete Metadata API documentation
- `references/structured-data.md` - JSON-LD schema patterns
- `references/core-web-vitals.md` - Performance optimization guide

## Key Principles

1. **Every page needs metadata** - Title, description, OG image
2. **Structured data enriches results** - Use BlogPosting, Organization, BreadcrumbList
3. **Performance is ranking factor** - Optimize LCP, CLS, INP
4. **Mobile-first indexing** - Ensure mobile responsiveness

## Implementation Checklist

### Technical SEO

- [ ] `metadataBase` set in root layout
- [ ] Title template configured (`%s | Site Name`)
- [ ] Unique descriptions per page
- [ ] Canonical URLs set
- [ ] Open Graph images (1200x630)
- [ ] Twitter Card configuration
- [ ] XML sitemap generated
- [ ] robots.txt configured

### Structured Data

- [ ] Organization schema on homepage
- [ ] BlogPosting schema on articles
- [ ] BreadcrumbList on all pages
- [ ] WebSite schema with search action
- [ ] Test with Google Rich Results

### Performance

- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] INP < 200ms
- [ ] Images use next/image
- [ ] Fonts optimized

## Common Patterns

### Metadata Factory

```typescript
// lib/metadata.ts
export function createMetadata({
  title,
  description,
  path,
  image,
}: MetadataOptions): Metadata {
  return {
    title,
    description,
    openGraph: { title, description, url: `${baseUrl}${path}`, images: [image] },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `${baseUrl}${path}` },
  };
}
```

### JSON-LD Components

```typescript
// components/json-ld/blog-posting.tsx
export function BlogPostingLd({ title, date, author, url }: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    datePublished: date,
    author: { "@type": "Person", name: author },
    url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

## Validation Tools

- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

## Resources

- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Schema.org](https://schema.org/)
- [Google Search Central](https://developers.google.com/search)
- [Web Vitals](https://web.dev/vitals/)
