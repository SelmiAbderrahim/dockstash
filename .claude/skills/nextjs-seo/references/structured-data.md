# JSON-LD Structured Data Reference

Complete guide for implementing structured data in Next.js applications.

## What is Structured Data?

Structured data helps search engines understand your content and can enable rich results in search:
- Knowledge panels
- Rich snippets
- Breadcrumb trails
- FAQ accordions
- How-to steps

## Implementation Pattern

### JSON-LD Component Pattern

```typescript
// components/json-ld/base.tsx
interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

### Type-Safe with schema-dts

```typescript
// Install: npm install schema-dts
import type { BlogPosting, WithContext } from "schema-dts";

export function BlogPostingLd(props: BlogPostingProps) {
  const jsonLd: WithContext<BlogPosting> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    // ... type-safe properties
  };

  return <JsonLd data={jsonLd} />;
}
```

## Schema Types

### Organization

Use on homepage or about page:

```typescript
// components/json-ld/organization.tsx
import type { Organization, WithContext } from "schema-dts";

interface OrganizationLdProps {
  name: string;
  url: string;
  logo: string;
  description?: string;
  sameAs?: string[];
  contactEmail?: string;
}

export function OrganizationLd({
  name,
  url,
  logo,
  description,
  sameAs,
  contactEmail,
}: OrganizationLdProps) {
  const jsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo: {
      "@type": "ImageObject",
      url: logo,
    },
    description,
    sameAs, // Social profiles
    ...(contactEmail && {
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: contactEmail,
      },
    }),
  };

  return <JsonLd data={jsonLd} />;
}

// Usage
<OrganizationLd
  name="ServerlessBase"
  url="https://serverlessbase.com"
  logo="https://serverlessbase.com/logo.png"
  description="Modern deployment platform"
  sameAs={[
    "https://twitter.com/serverlessbase",
    "https://github.com/serverlessbase",
    "https://linkedin.com/company/serverlessbase",
  ]}
  contactEmail="support@serverlessbase.com"
/>
```

### WebSite with Search

Enable sitelinks search box:

```typescript
// components/json-ld/website.tsx
import type { WebSite, WithContext } from "schema-dts";

interface WebSiteLdProps {
  name: string;
  url: string;
  searchUrl?: string;
}

export function WebSiteLd({ name, url, searchUrl }: WebSiteLdProps) {
  const jsonLd: WithContext<WebSite> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    ...(searchUrl && {
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: searchUrl,
        },
        "query-input": "required name=search_term_string",
      },
    }),
  };

  return <JsonLd data={jsonLd} />;
}

// Usage
<WebSiteLd
  name="ServerlessBase"
  url="https://serverlessbase.com"
  searchUrl="https://serverlessbase.com/search?q={search_term_string}"
/>
```

### BlogPosting

For blog articles:

```typescript
// components/json-ld/blog-posting.tsx
import type { BlogPosting, WithContext } from "schema-dts";

interface BlogPostingLdProps {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author: {
    name: string;
    url?: string;
  };
  publisher: {
    name: string;
    logo: string;
  };
  image?: string;
  keywords?: string[];
  wordCount?: number;
}

export function BlogPostingLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  author,
  publisher,
  image,
  keywords,
  wordCount,
}: BlogPostingLdProps) {
  const jsonLd: WithContext<BlogPosting> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    url,
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      "@type": "Person",
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    publisher: {
      "@type": "Organization",
      name: publisher.name,
      logo: {
        "@type": "ImageObject",
        url: publisher.logo,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    ...(image && {
      image: {
        "@type": "ImageObject",
        url: image,
      },
    }),
    ...(keywords && { keywords: keywords.join(", ") }),
    ...(wordCount && { wordCount }),
  };

  return <JsonLd data={jsonLd} />;
}
```

### BreadcrumbList

For navigation hierarchy:

```typescript
// components/json-ld/breadcrumb.tsx
import type { BreadcrumbList, WithContext } from "schema-dts";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbLdProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbLd({ items }: BreadcrumbLdProps) {
  const jsonLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <JsonLd data={jsonLd} />;
}

// Usage
<BreadcrumbLd
  items={[
    { name: "Home", url: "https://serverlessbase.com" },
    { name: "Blog", url: "https://serverlessbase.com/blog" },
    { name: "Docker Guide", url: "https://serverlessbase.com/blog/docker-guide" },
  ]}
/>
```

### FAQPage

For FAQ sections:

```typescript
// components/json-ld/faq.tsx
import type { FAQPage, WithContext } from "schema-dts";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqLdProps {
  items: FaqItem[];
}

export function FaqLd({ items }: FaqLdProps) {
  const jsonLd: WithContext<FAQPage> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return <JsonLd data={jsonLd} />;
}
```

### HowTo

For tutorial/guide content:

```typescript
// components/json-ld/how-to.tsx
import type { HowTo, WithContext } from "schema-dts";

interface HowToStep {
  name: string;
  text: string;
  image?: string;
  url?: string;
}

interface HowToLdProps {
  name: string;
  description: string;
  image?: string;
  totalTime?: string; // ISO 8601 duration
  steps: HowToStep[];
}

export function HowToLd({
  name,
  description,
  image,
  totalTime,
  steps,
}: HowToLdProps) {
  const jsonLd: WithContext<HowTo> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    ...(image && { image }),
    ...(totalTime && { totalTime }),
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
      ...(step.url && { url: step.url }),
    })),
  };

  return <JsonLd data={jsonLd} />;
}
```

### SoftwareApplication

For software/app pages:

```typescript
// components/json-ld/software.tsx
import type { SoftwareApplication, WithContext } from "schema-dts";

interface SoftwareLdProps {
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem: string;
  url: string;
  screenshot?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
  };
}

export function SoftwareLd({
  name,
  description,
  applicationCategory,
  operatingSystem,
  url,
  screenshot,
  offers,
  aggregateRating,
}: SoftwareLdProps) {
  const jsonLd: WithContext<SoftwareApplication> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory,
    operatingSystem,
    url,
    ...(screenshot && { screenshot }),
    ...(offers && {
      offers: {
        "@type": "Offer",
        price: offers.price,
        priceCurrency: offers.priceCurrency,
      },
    }),
    ...(aggregateRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: aggregateRating.ratingValue,
        ratingCount: aggregateRating.ratingCount,
      },
    }),
  };

  return <JsonLd data={jsonLd} />;
}
```

## Multiple Schemas

You can include multiple schemas on a page:

```typescript
// app/blog/[slug]/page.tsx
export default function BlogPost({ post }) {
  return (
    <>
      {/* Organization context */}
      <OrganizationLd
        name="ServerlessBase"
        url="https://serverlessbase.com"
        logo="https://serverlessbase.com/logo.png"
      />

      {/* Breadcrumb navigation */}
      <BreadcrumbLd
        items={[
          { name: "Home", url: "https://serverlessbase.com" },
          { name: "Blog", url: "https://serverlessbase.com/blog" },
          { name: post.title, url: `https://serverlessbase.com/blog/${post.slug}` },
        ]}
      />

      {/* Article content */}
      <BlogPostingLd
        title={post.title}
        description={post.description}
        url={`https://serverlessbase.com/blog/${post.slug}`}
        datePublished={post.date}
        author={{ name: post.author }}
        publisher={{
          name: "ServerlessBase",
          logo: "https://serverlessbase.com/logo.png",
        }}
        image={post.image}
      />

      <article>{/* content */}</article>
    </>
  );
}
```

## Testing & Validation

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Schema Markup Validator**: https://validator.schema.org/
3. **Google Search Console**: Monitor rich results performance

## Common Mistakes

1. **Missing required properties** - Always check schema.org requirements
2. **Wrong date format** - Use ISO 8601 (YYYY-MM-DD or full ISO)
3. **Relative URLs** - Always use absolute URLs
4. **Duplicate schemas** - Don't repeat Organization on every page
5. **Invalid nesting** - Follow schema hierarchy

## Best Practices

1. **Be accurate** - Only mark up visible content
2. **Be specific** - Use the most specific type available
3. **Be complete** - Include all recommended properties
4. **Test regularly** - Validate after changes
5. **Monitor performance** - Check Search Console reports
