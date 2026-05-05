# Fumadocs MDX Patterns Reference

Complete guide for configuring and using Fumadocs MDX in Next.js blogs.

## Installation

```bash
npm install fumadocs-mdx fumadocs-core fumadocs-ui
npm install -D @types/mdx
```

## Source Configuration

### Basic Configuration

```typescript
// source.config.ts
import {
  defineCollections,
  defineConfig,
  frontmatterSchema,
} from "fumadocs-mdx/config";
import { z } from "zod";

export const blog = defineCollections({
  type: "doc",
  dir: "content",
  schema: frontmatterSchema.extend({
    // Required fields
    date: z
      .string()
      .or(z.date())
      .transform((value, context) => {
        try {
          return new Date(value);
        } catch {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid date",
          });
          return z.NEVER;
        }
      }),
    author: z.string(),

    // Optional fields
    tags: z.array(z.string()).optional(),
    image: z.string().optional(),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    readingTime: z.number().optional(),
  }),
});

export default defineConfig({
  // Use git commit time for lastModified
  lastModifiedTime: "git",
});
```

### Advanced Code Highlighting

```typescript
// source.config.ts
import { transformerRemoveNotationEscape } from "@shikijs/transformers";
import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import { transformerTwoslash } from "fumadocs-twoslash";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export default defineConfig({
  lastModifiedTime: "git",
  mdxOptions: {
    rehypeCodeOptions: {
      // Inline code: `code{:lang}`
      inline: "tailing-curly-colon",

      // Syntax themes
      themes: {
        light: "catppuccin-latte",
        dark: "catppuccin-mocha",
      },

      // Code transformers
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        // TypeScript type hints on hover
        transformerTwoslash(),
        // Remove notation escape characters
        transformerRemoveNotationEscape(),
      ],
    },

    // Remark plugins (before MDX)
    remarkPlugins: [remarkMath],

    // Rehype plugins (after MDX)
    rehypePlugins: (v) => [rehypeKatex, ...v],
  },
});
```

## Source Loader

### Basic Setup

```typescript
// lib/source.ts
import { blog } from "@/.source";
import { loader } from "fumadocs-core/source";

export const blogSource = loader({
  baseUrl: "/blog",
  source: blog.toFumadocs(),
});
```

### Helper Functions

```typescript
// lib/source.ts

// Get all published posts, sorted by date
export function getAllPosts() {
  return blogSource
    .getPages()
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// Get featured posts
export function getFeaturedPosts(limit = 3) {
  return getAllPosts()
    .filter((post) => post.data.featured)
    .slice(0, limit);
}

// Get recent posts
export function getRecentPosts(limit = 5) {
  return getAllPosts().slice(0, limit);
}

// Get posts by tag
export function getPostsByTag(tag: string) {
  return getAllPosts().filter((post) =>
    post.data.tags?.includes(tag)
  );
}

// Get all unique tags with counts
export function getAllTags() {
  const posts = getAllPosts();
  const tagCounts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// Get related posts based on tag overlap
export function getRelatedPosts(currentSlug: string, limit = 3) {
  const current = blogSource.getPage([currentSlug]);
  if (!current) return [];

  const currentTags = new Set(current.data.tags ?? []);

  return getAllPosts()
    .filter((post) => post.slugs.join("/") !== currentSlug)
    .map((post) => {
      const commonTags = (post.data.tags ?? []).filter((tag) =>
        currentTags.has(tag)
      );
      return { post, score: commonTags.length };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.post);
}

// Get post by slug
export function getPost(slug: string) {
  return blogSource.getPage([slug]);
}

// Check if post exists
export function postExists(slug: string) {
  return blogSource.getPage([slug]) !== undefined;
}

// Get previous and next posts
export function getAdjacentPosts(currentSlug: string) {
  const posts = getAllPosts();
  const currentIndex = posts.findIndex(
    (post) => post.slugs.join("/") === currentSlug
  );

  return {
    previous: currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null,
    next: currentIndex > 0 ? posts[currentIndex - 1] : null,
  };
}
```

## MDX Components

### Component Registry

```typescript
// components/mdx/index.tsx
import type { MDXComponents } from "mdx/types";
import { Callout } from "./callout";
import { CodeBlock } from "./code-block";
import { ImageZoom } from "./image-zoom";
import { Steps, Step } from "./steps";
import { Tabs, Tab } from "./tabs";
import { Card, Cards } from "./cards";
import { Accordion, AccordionItem } from "./accordion";
import { YouTube } from "./youtube";
import Link from "next/link";
import Image from "next/image";

export const mdxComponents: MDXComponents = {
  // Custom components
  Callout,
  CodeBlock,
  ImageZoom,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  Cards,
  Accordion,
  AccordionItem,
  YouTube,

  // Override default elements
  a: ({ href, children, ...props }) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-4"
        {...props}
      >
        {children}
      </a>
    );
  },

  img: ({ src, alt, ...props }) => (
    <Image
      src={src || ""}
      alt={alt || ""}
      width={800}
      height={400}
      className="rounded-lg"
      {...props}
    />
  ),

  h1: (props) => (
    <h1
      className="scroll-m-20 text-4xl font-bold tracking-tight"
      {...props}
    />
  ),

  h2: (props) => (
    <h2
      className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mt-10 first:mt-0"
      {...props}
    />
  ),

  h3: (props) => (
    <h3
      className="scroll-m-20 text-2xl font-semibold tracking-tight mt-8"
      {...props}
    />
  ),

  p: (props) => (
    <p className="leading-7 [&:not(:first-child)]:mt-6" {...props} />
  ),

  ul: (props) => (
    <ul className="my-6 ms-6 list-disc [&>li]:mt-2" {...props} />
  ),

  ol: (props) => (
    <ol className="my-6 ms-6 list-decimal [&>li]:mt-2" {...props} />
  ),

  blockquote: (props) => (
    <blockquote
      className="mt-6 border-s-2 ps-6 italic text-muted-foreground"
      {...props}
    />
  ),

  table: (props) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full" {...props} />
    </div>
  ),

  th: (props) => (
    <th
      className="border px-4 py-2 text-start font-bold [&[align=center]]:text-center [&[align=right]]:text-end"
      {...props}
    />
  ),

  td: (props) => (
    <td
      className="border px-4 py-2 text-start [&[align=center]]:text-center [&[align=right]]:text-end"
      {...props}
    />
  ),

  pre: (props) => (
    <pre
      className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted p-4"
      {...props}
    />
  ),

  code: (props) => (
    <code
      className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm"
      {...props}
    />
  ),

  hr: () => <hr className="my-8 border-border" />,
};
```

### Callout Component

```typescript
// components/mdx/callout.tsx
import { AlertCircle, Info, Lightbulb, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutType = "info" | "warning" | "danger" | "tip" | "success";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const config = {
  info: {
    icon: Info,
    style: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  warning: {
    icon: AlertTriangle,
    style: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  },
  danger: {
    icon: AlertCircle,
    style: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  tip: {
    icon: Lightbulb,
    style: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
  },
  success: {
    icon: CheckCircle,
    style: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

export function Callout({ type = "info", title, children }: CalloutProps) {
  const { icon: Icon, style } = config[type];

  return (
    <div className={cn("my-6 flex gap-3 rounded-lg border p-4", style)}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div className="text-sm [&>p]:m-0 [&>p:not(:last-child)]:mb-2">
          {children}
        </div>
      </div>
    </div>
  );
}
```

### Steps Component

```typescript
// components/mdx/steps.tsx
import { cn } from "@/lib/utils";

interface StepsProps {
  children: React.ReactNode;
}

export function Steps({ children }: StepsProps) {
  return (
    <div className="relative ms-4 border-s border-border ps-6 [counter-reset:step]">
      {children}
    </div>
  );
}

interface StepProps {
  title?: string;
  children: React.ReactNode;
}

export function Step({ title, children }: StepProps) {
  return (
    <div className="relative pb-8 last:pb-0 [counter-increment:step]">
      <div
        className={cn(
          "absolute -start-6 flex h-8 w-8 items-center justify-center rounded-full",
          "border-4 border-background bg-primary text-primary-foreground",
          "text-sm font-semibold -translate-x-1/2",
          "before:content-[counter(step)]"
        )}
      />
      <div className="pt-1">
        {title && (
          <h4 className="font-semibold text-lg mb-2">{title}</h4>
        )}
        <div className="text-muted-foreground [&>p]:m-0">{children}</div>
      </div>
    </div>
  );
}
```

### YouTube Embed

```typescript
// components/mdx/youtube.tsx
interface YouTubeProps {
  id: string;
  title?: string;
}

export function YouTube({ id, title = "YouTube Video" }: YouTubeProps) {
  return (
    <div className="relative my-6 aspect-video overflow-hidden rounded-lg">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
```

## Blog Pages

### List Page

```typescript
// app/blog/page.tsx
import { getAllPosts, getAllTags } from "@/lib/source";
import { PostCard } from "@/components/blog/post-card";
import { TagFilter } from "@/components/blog/tag-filter";
import { Pagination } from "@/components/blog/pagination";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description: "Latest articles and tutorials",
};

interface Props {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

export default async function BlogPage({ searchParams }: Props) {
  const { page = "1", tag } = await searchParams;
  const currentPage = parseInt(page);
  const postsPerPage = 10;

  let posts = getAllPosts();
  const tags = getAllTags();

  // Filter by tag if provided
  if (tag) {
    posts = posts.filter((post) => post.data.tags?.includes(tag));
  }

  // Calculate pagination
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const paginatedPosts = posts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

  return (
    <main className="container py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Blog</h1>
        <p className="text-muted-foreground text-lg">
          {tag
            ? `Posts tagged with "${tag}"`
            : "Latest articles and tutorials"}
        </p>
      </div>

      <TagFilter tags={tags} activeTag={tag} />

      <div className="grid gap-6 mt-8">
        {paginatedPosts.map((post) => (
          <PostCard key={post.slugs.join("/")} post={post} />
        ))}
      </div>

      {paginatedPosts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No posts found.
        </p>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          baseUrl="/blog"
          searchParams={tag ? { tag } : undefined}
        />
      )}
    </main>
  );
}
```

### Post Page

```typescript
// app/blog/[slug]/page.tsx
import { blogSource, getRelatedPosts, getAdjacentPosts } from "@/lib/source";
import { notFound } from "next/navigation";
import { MDXContent } from "fumadocs-ui/mdx";
import { mdxComponents } from "@/components/mdx";
import { PostHeader } from "@/components/blog/post-header";
import { TableOfContents } from "@/components/blog/toc";
import { RelatedPosts } from "@/components/blog/related-posts";
import { PostNavigation } from "@/components/blog/post-navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = blogSource.getPage([slug]);

  if (!post) {
    return { title: "Post Not Found" };
  }

  return {
    title: post.data.title,
    description: post.data.description,
  };
}

export async function generateStaticParams() {
  const posts = blogSource.getPages();
  return posts.map((post) => ({ slug: post.slugs.join("/") }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogSource.getPage([slug]);

  if (!post) {
    notFound();
  }

  const MDX = post.data.body;
  const related = getRelatedPosts(slug);
  const { previous, next } = getAdjacentPosts(slug);

  return (
    <article className="container py-12">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12">
        <main className="min-w-0">
          <PostHeader
            title={post.data.title}
            date={post.data.date}
            author={post.data.author}
            tags={post.data.tags}
            image={post.data.image}
          />

          <div className="prose dark:prose-invert max-w-none mt-8">
            <MDXContent components={mdxComponents}>
              <MDX />
            </MDXContent>
          </div>

          <PostNavigation previous={previous} next={next} />
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <TableOfContents toc={post.data.toc} />
          </div>
        </aside>
      </div>

      {related.length > 0 && <RelatedPosts posts={related} />}
    </article>
  );
}
```

## Usage in MDX

```mdx
---
title: "Getting Started with Docker"
description: "Learn Docker basics"
date: 2024-01-15
author: "John Doe"
tags:
  - docker
  - tutorial
---

# Introduction

Welcome to this Docker tutorial!

<Callout type="info" title="Prerequisites">
  Make sure you have Docker installed before continuing.
</Callout>

## Installation Steps

<Steps>
  <Step title="Download Docker">
    Visit docker.com and download for your OS.
  </Step>

  <Step title="Install">
    Run the installer and follow the prompts.
  </Step>

  <Step title="Verify">
    Run `docker --version` to verify installation.
  </Step>
</Steps>

## Video Tutorial

<YouTube id="fqMOX6JJhGo" title="Docker Tutorial" />

## Code Example

```typescript twoslash
const greeting = "Hello, Docker!";
//    ^?
console.log(greeting);
```

<Callout type="tip">
  Use `docker compose` for multi-container applications.
</Callout>
```
