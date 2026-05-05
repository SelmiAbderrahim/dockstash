# Next.js Metadata API Reference

Complete reference for implementing SEO metadata in Next.js 15 App Router.

## Static Metadata

Define metadata as a constant export in layout.tsx or page.tsx:

```typescript
// app/layout.tsx
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  // Base URL for relative URLs
  metadataBase: new URL("https://serverlessbase.com"),

  // Title with template
  title: {
    default: "ServerlessBase",
    template: "%s | ServerlessBase",
  },

  // Description
  description: "Modern deployment platform for developers",

  // Keywords (less important for SEO now)
  keywords: ["serverless", "deployment", "devops"],

  // Author information
  authors: [{ name: "ServerlessBase Team", url: "https://serverlessbase.com" }],
  creator: "ServerlessBase",
  publisher: "ServerlessBase",

  // Generator
  generator: "Next.js",

  // Application name (for mobile)
  applicationName: "ServerlessBase",

  // Referrer policy
  referrer: "origin-when-cross-origin",

  // Color scheme
  colorScheme: "dark light",

  // Format detection (disable phone number detection)
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "de_DE", "es_ES", "fr_FR"],
    url: "https://serverlessbase.com",
    siteName: "ServerlessBase",
    title: "ServerlessBase",
    description: "Modern deployment platform for developers",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ServerlessBase - Modern Deployment Platform",
        type: "image/png",
      },
    ],
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    site: "@serverlessbase",
    creator: "@serverlessbase",
    title: "ServerlessBase",
    description: "Modern deployment platform for developers",
    images: ["/twitter-image.png"],
  },

  // Alternates
  alternates: {
    canonical: "https://serverlessbase.com",
    languages: {
      "en-US": "https://serverlessbase.com",
      "ar-SA": "https://serverlessbase.com/ar",
      "de-DE": "https://serverlessbase.com/de",
    },
    types: {
      "application/rss+xml": "https://serverlessbase.com/feed.xml",
      "application/atom+xml": "https://serverlessbase.com/atom.xml",
    },
  },

  // Verification
  verification: {
    google: "google-site-verification-code",
    yandex: "yandex-verification-code",
    yahoo: "yahoo-verification-code",
    other: {
      me: ["my-email@example.com", "https://example.com/profile"],
    },
  },

  // Apple Web App
  appleWebApp: {
    capable: true,
    title: "ServerlessBase",
    statusBarStyle: "black-translucent",
  },

  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/shortcut-icon.png"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#2563eb",
      },
    ],
  },

  // Manifest
  manifest: "/site.webmanifest",

  // Category
  category: "technology",

  // Classification
  classification: "Business Software",

  // Archive
  archives: ["https://serverlessbase.com/blog/archive"],

  // Assets
  assets: ["https://serverlessbase.com/assets"],

  // Bookmarks
  bookmarks: ["https://serverlessbase.com/blog"],

  // Other
  other: {
    "msapplication-TileColor": "#2563eb",
    "msapplication-config": "/browserconfig.xml",
  },
};
```

## Dynamic Metadata

Use `generateMetadata` for dynamic pages:

```typescript
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;

  // Fetch data
  const post = await getPost(slug);

  // Access parent metadata
  const previousImages = (await parent).openGraph?.images || [];

  // Handle not found
  if (!post) {
    return {
      title: "Post Not Found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
      images: [
        post.image
          ? { url: post.image, width: 1200, height: 630, alt: post.title }
          : ...previousImages,
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: post.image ? [post.image] : undefined,
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}
```

## File-based Metadata

### opengraph-image.tsx

```typescript
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Blog Post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(to bottom right, #1e3a8a, #3b82f6)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <h1
          style={{
            fontSize: 64,
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
          }}
        >
          {post?.title || "Blog Post"}
        </h1>
      </div>
    ),
    { ...size }
  );
}
```

### twitter-image.tsx

```typescript
// app/twitter-image.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ServerlessBase";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ /* styles */ }}>
        <h1>ServerlessBase</h1>
      </div>
    ),
    { ...size }
  );
}
```

### sitemap.ts

```typescript
// app/sitemap.ts
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://serverlessbase.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // Dynamic pages
  const posts = await getAllPosts();
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt || post.createdAt,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}
```

### robots.ts

```typescript
// app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://serverlessbase.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/dashboard/", "/_next/", "/private/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
```

### manifest.ts

```typescript
// app/manifest.ts
import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ServerlessBase",
    short_name: "SB",
    description: "Modern deployment platform",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

## Metadata Merging

Metadata from nested layouts is merged automatically:

```
app/layout.tsx (base metadata)
  └── app/blog/layout.tsx (blog-specific metadata)
        └── app/blog/[slug]/page.tsx (page-specific metadata)
```

Child metadata overwrites parent for same fields. Arrays are replaced, not merged.

## Best Practices

1. **Always set metadataBase** in root layout
2. **Use title template** for consistent titles
3. **Provide unique descriptions** per page
4. **Set canonical URLs** to prevent duplicate content
5. **Use absolute URLs** for images in OG/Twitter
6. **Test with validators** before deploying
