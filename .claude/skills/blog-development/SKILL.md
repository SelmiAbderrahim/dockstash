---
name: blog-development
description: |
  Comprehensive guide for building blogs with Fumadocs MDX and Next.js 15. Covers MDX collections, frontmatter schemas, code highlighting, @fuma-comment integration, and newsletter workflows with Resend. Use when building blog features, managing content, or implementing engagement systems.
license: MIT
metadata:
  version: "1.0.0"
  category: "content"
  dependencies: "fumadocs-mdx, fumadocs-core, @fuma-comment, resend, drizzle-orm"
---

# Blog Development with Fumadocs MDX

This skill provides comprehensive guidance for building blogs with Fumadocs MDX in Next.js 15 applications.

## When to Use This Skill

Use this skill when:
- Setting up Fumadocs MDX collections
- Creating frontmatter schemas with Zod
- Implementing code highlighting (Shiki, Twoslash)
- Adding comment systems (@fuma-comment)
- Building newsletter workflows (Resend)
- Creating tag pages and filtering

## Quick Reference

### MDX Collection

```typescript
// source.config.ts
export const blog = defineCollections({
  type: "doc",
  dir: "content",
  schema: frontmatterSchema.extend({
    date: z.string().or(z.date()).transform((v) => new Date(v)),
    author: z.string(),
    tags: z.array(z.string()).optional(),
  }),
});
```

### Source Loader

```typescript
// lib/source.ts
import { blog } from "@/.source";
import { loader } from "fumadocs-core/source";

export const blogSource = loader({
  baseUrl: "/blog",
  source: blog.toFumadocs(),
});
```

### Blog Post Page

```typescript
// app/blog/[slug]/page.tsx
const post = blogSource.getPage([slug]);
const MDX = post.data.body;

return (
  <MDXContent components={mdxComponents}>
    <MDX />
  </MDXContent>
);
```

## Reference Files

- `references/fumadocs-patterns.md` - MDX configuration and components
- `references/newsletter-workflow.md` - Email newsletter with Resend
- `references/comment-system.md` - @fuma-comment integration

## Key Patterns

### Content Structure

```
content/
├── hello-world.mdx
├── getting-started/
│   └── index.mdx
└── tutorials/
    ├── docker-basics.mdx
    └── kubernetes-intro.mdx
```

### Frontmatter

```yaml
---
title: "Getting Started with Docker"
description: "A beginner's guide to Docker containers"
date: 2024-01-15
author: "John Doe"
tags:
  - docker
  - tutorial
image: /images/docker-guide.png
featured: true
---
```

### Helper Functions

```typescript
// Get all posts (sorted, excluding drafts)
export function getAllPosts() {
  return blogSource
    .getPages()
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// Get posts by tag
export function getPostsByTag(tag: string) {
  return getAllPosts().filter((post) =>
    post.data.tags?.includes(tag)
  );
}

// Get related posts
export function getRelatedPosts(slug: string, limit = 3) {
  const current = blogSource.getPage([slug]);
  const currentTags = new Set(current?.data.tags ?? []);

  return getAllPosts()
    .filter((post) => post.slugs.join("/") !== slug)
    .map((post) => ({
      post,
      score: (post.data.tags ?? []).filter((t) => currentTags.has(t)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.post);
}
```

## Implementation Checklist

### Content Setup

- [ ] `source.config.ts` configured
- [ ] Frontmatter schema defined
- [ ] Source loader created
- [ ] Helper functions implemented
- [ ] MDX components registered

### Code Highlighting

- [ ] Shiki themes configured
- [ ] Twoslash enabled (optional)
- [ ] KaTeX for math (optional)
- [ ] Copy button on code blocks

### Blog Features

- [ ] List page with pagination
- [ ] Tag filtering
- [ ] Search functionality
- [ ] Related posts
- [ ] Table of contents
- [ ] Reading time estimate

### Engagement

- [ ] Comments (@fuma-comment)
- [ ] Newsletter subscription
- [ ] Social sharing
- [ ] RSS/Atom feeds

## Common Patterns

### Tag Page

```typescript
// app/blog/tag/[tag]/page.tsx
export default async function TagPage({ params }) {
  const { tag } = await params;
  const posts = getPostsByTag(tag);

  return (
    <main>
      <h1>Posts tagged "{tag}"</h1>
      {posts.map((post) => (
        <PostCard key={post.slugs.join("/")} post={post} />
      ))}
    </main>
  );
}

export async function generateStaticParams() {
  const tags = getAllTags();
  return tags.map((tag) => ({ tag: tag.name }));
}
```

### Pagination

```typescript
// app/blog/page.tsx
export default async function BlogPage({ searchParams }) {
  const { page = "1" } = await searchParams;
  const currentPage = parseInt(page);
  const postsPerPage = 10;

  const allPosts = getAllPosts();
  const totalPages = Math.ceil(allPosts.length / postsPerPage);
  const posts = allPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

  return (
    <main>
      <PostList posts={posts} />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        baseUrl="/blog"
      />
    </main>
  );
}
```

## Resources

- [Fumadocs Documentation](https://fumadocs.vercel.app/)
- [Fumadocs MDX](https://fumadocs.vercel.app/docs/mdx)
- [Shiki](https://shiki.style/)
- [Resend](https://resend.com/docs)
- [@fuma-comment](https://github.com/fuma-nama/fuma-comment)
