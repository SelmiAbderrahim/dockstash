# Core Web Vitals Optimization Reference

Guide for optimizing Core Web Vitals in Next.js applications.

## Core Web Vitals Metrics

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

## LCP Optimization

### What Triggers LCP

- `<img>` elements
- `<image>` inside SVG
- `<video>` poster images
- Background images via CSS
- Block-level text elements

### Optimization Strategies

#### 1. Prioritize Above-the-Fold Images

```typescript
// components/hero-image.tsx
import Image from "next/image";

export function HeroImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={630}
      priority // Preload this image
      fetchPriority="high" // Browser hint
      sizes="100vw"
      quality={85}
    />
  );
}
```

#### 2. Preload Critical Resources

```typescript
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  // Preload critical font
  other: {
    "link": [
      {
        rel: "preload",
        href: "/fonts/geist.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  },
};
```

#### 3. Optimize Server Response Time

```typescript
// Use streaming with Suspense
import { Suspense } from "react";

export default function Page() {
  return (
    <main>
      {/* Hero loads first */}
      <HeroSection />

      {/* Heavy content streams in */}
      <Suspense fallback={<ContentSkeleton />}>
        <HeavyContent />
      </Suspense>
    </main>
  );
}
```

#### 4. Use next/image Optimization

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
};
```

## INP Optimization

### What Causes Poor INP

- Long JavaScript tasks
- Heavy event handlers
- Synchronous layouts
- Main thread blocking

### Optimization Strategies

#### 1. Use React Transitions

```typescript
"use client";

import { useTransition } from "react";

export function SearchResults({ query }: { query: string }) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState([]);

  const handleSearch = (newQuery: string) => {
    // Non-blocking update
    startTransition(() => {
      const filtered = filterResults(newQuery);
      setResults(filtered);
    });
  };

  return (
    <div className={isPending ? "opacity-50" : ""}>
      <input onChange={(e) => handleSearch(e.target.value)} />
      <ul>
        {results.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

#### 2. Debounce Expensive Operations

```typescript
"use client";

import { useDeferredValue } from "react";

export function SearchInput() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* Results update with lower priority */}
      <SearchResults query={deferredQuery} />
    </>
  );
}
```

#### 3. Break Up Long Tasks

```typescript
// Use requestIdleCallback for non-critical work
function processLargeDataset(items: Item[]) {
  const CHUNK_SIZE = 100;
  let index = 0;

  function processChunk(deadline: IdleDeadline) {
    while (index < items.length && deadline.timeRemaining() > 0) {
      processItem(items[index]);
      index++;
    }

    if (index < items.length) {
      requestIdleCallback(processChunk);
    }
  }

  requestIdleCallback(processChunk);
}
```

#### 4. Optimize Event Handlers

```typescript
"use client";

import { useCallback } from "react";

export function OptimizedList({ items }: { items: Item[] }) {
  // Single handler for delegation
  const handleClick = useCallback((e: React.MouseEvent<HTMLUListElement>) => {
    const target = e.target as HTMLElement;
    const itemId = target.closest("li")?.dataset.id;

    if (itemId) {
      // Handle click
    }
  }, []);

  return (
    <ul onClick={handleClick}>
      {items.map((item) => (
        <li key={item.id} data-id={item.id}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

## CLS Optimization

### What Causes Layout Shifts

- Images without dimensions
- Ads/embeds without reserved space
- Dynamically injected content
- Web fonts causing FOIT/FOUT
- CSS animations

### Optimization Strategies

#### 1. Always Set Image Dimensions

```typescript
// GOOD - Dimensions prevent shift
<Image src="/hero.jpg" alt="Hero" width={1200} height={630} />

// GOOD - Aspect ratio container
<div className="relative aspect-video">
  <Image src="/hero.jpg" alt="Hero" fill className="object-cover" />
</div>

// BAD - No dimensions
<img src="/hero.jpg" alt="Hero" />
```

#### 2. Reserve Space for Dynamic Content

```typescript
// Reserve space for ads/embeds
<div className="min-h-[250px] bg-muted">
  <Suspense fallback={<AdPlaceholder />}>
    <Advertisement />
  </Suspense>
</div>
```

#### 3. Optimize Font Loading

```typescript
// app/layout.tsx
import { GeistSans } from "geist/font/sans";

export default function RootLayout({ children }) {
  return (
    <html className={GeistSans.className}>
      <body>{children}</body>
    </html>
  );
}

// CSS fallback sizing
// globals.css
:root {
  --font-sans: "Geist", system-ui, sans-serif;
}

body {
  font-family: var(--font-sans);
  /* Match fallback metrics */
  font-size-adjust: 0.5;
}
```

#### 4. Avoid Injecting Content Above Existing

```typescript
// BAD - Notification pushes content down
function BadPattern() {
  return (
    <>
      {showNotification && <Notification />} {/* Causes shift */}
      <MainContent />
    </>
  );
}

// GOOD - Fixed position doesn't affect layout
function GoodPattern() {
  return (
    <>
      <MainContent />
      {showNotification && (
        <div className="fixed top-4 right-4">
          <Notification />
        </div>
      )}
    </>
  );
}
```

#### 5. Use CSS Transforms for Animations

```typescript
// BAD - Animating layout properties
.slide-in {
  animation: slideIn 0.3s;
}

@keyframes slideIn {
  from { margin-left: -100%; } /* Causes layout */
  to { margin-left: 0; }
}

// GOOD - Using transforms
.slide-in {
  animation: slideIn 0.3s;
}

@keyframes slideIn {
  from { transform: translateX(-100%); } /* No layout */
  to { transform: translateX(0); }
}
```

## Measuring Performance

### Web Vitals Package

```typescript
// lib/vitals.ts
import { onCLS, onINP, onLCP } from "web-vitals";

export function reportWebVitals() {
  onCLS((metric) => {
    console.log("CLS:", metric.value);
    // Send to analytics
  });

  onINP((metric) => {
    console.log("INP:", metric.value);
  });

  onLCP((metric) => {
    console.log("LCP:", metric.value);
  });
}
```

### Next.js Built-in Reporting

```typescript
// app/layout.tsx
export function reportWebVitals(metric: NextWebVitalsMetric) {
  switch (metric.name) {
    case "TTFB":
    case "FCP":
    case "LCP":
    case "CLS":
    case "INP":
      console.log(metric);
      break;
  }
}
```

## Performance Checklist

### LCP Checklist

- [ ] Hero images have `priority` attribute
- [ ] Critical resources are preloaded
- [ ] Server response time < 200ms
- [ ] Images optimized with next/image
- [ ] No render-blocking resources
- [ ] CDN for static assets

### INP Checklist

- [ ] No tasks > 50ms on main thread
- [ ] Heavy computation in Web Workers
- [ ] React Transitions for updates
- [ ] Debounced/throttled event handlers
- [ ] Code-split heavy components

### CLS Checklist

- [ ] All images have width/height
- [ ] Space reserved for dynamic content
- [ ] Fonts use `display: swap`
- [ ] No content injected above fold
- [ ] Animations use transforms
- [ ] Skeleton loaders match content size

## Tools

- **PageSpeed Insights**: https://pagespeed.web.dev/
- **Lighthouse**: Chrome DevTools
- **Web Vitals Extension**: Chrome extension
- **Search Console**: Core Web Vitals report
- **CrUX Dashboard**: Real user metrics
