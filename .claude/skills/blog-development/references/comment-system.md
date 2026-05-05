# @fuma-comment Integration Guide

Complete guide for integrating the @fuma-comment system in Next.js blogs.

## Overview

@fuma-comment is a comment system designed for Fumadocs that supports:
- Nested replies
- Like/dislike reactions
- Authentication integration
- Drizzle ORM adapter

## Installation

```bash
npm install @fuma-comment/react @fuma-comment/server
```

## Database Schema

### Drizzle ORM Schema

```typescript
// lib/db/schema.ts
import { pgTable, text, timestamp, uuid, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Comments table
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: text("post_id").notNull(), // Reference to blog post slug
  userId: uuid("user_id").notNull(), // Reference to user
  content: text("content").notNull(),
  parentId: uuid("parent_id"), // For nested replies
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

// Comment reactions (likes/dislikes)
export const commentRates = pgTable(
  "comment_rates",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    like: text("like").notNull(), // 'like' | 'dislike'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.commentId, table.userId] }),
  })
);

// Relations
export const commentsRelations = relations(comments, ({ one, many }) => ({
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "replies",
  }),
  replies: many(comments, { relationName: "replies" }),
  rates: many(commentRates),
}));

export const commentRatesRelations = relations(commentRates, ({ one }) => ({
  comment: one(comments, {
    fields: [commentRates.commentId],
    references: [comments.id],
  }),
}));
```

### Migration

```sql
-- Create comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP
);

-- Create comment_rates table
CREATE TABLE comment_rates (
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  "like" TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

-- Indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
```

## Server Adapter

### Drizzle Adapter

```typescript
// lib/comments/adapter.ts
import { createDrizzleAdapter } from "@fuma-comment/server/adapters/drizzle";
import { db } from "@/lib/db";
import { comments, commentRates } from "@/lib/db/schema";

export const commentAdapter = createDrizzleAdapter({
  db,
  schemas: {
    comments,
    rates: commentRates,
  },
});
```

### Custom Adapter (Alternative)

```typescript
// lib/comments/custom-adapter.ts
import type { StorageAdapter } from "@fuma-comment/server";
import { db } from "@/lib/db";
import { comments, commentRates } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

export const customAdapter: StorageAdapter = {
  // Get comments for a page
  async getComments(page: string) {
    const result = await db.query.comments.findMany({
      where: and(
        eq(comments.postId, page),
        isNull(comments.deletedAt)
      ),
      orderBy: desc(comments.createdAt),
      with: {
        rates: true,
      },
    });

    return result.map((comment) => ({
      id: comment.id,
      page: comment.postId,
      author: comment.userId,
      content: comment.content,
      timestamp: comment.createdAt,
      parent: comment.parentId,
      likes: comment.rates.filter((r) => r.like === "like").length,
      dislikes: comment.rates.filter((r) => r.like === "dislike").length,
    }));
  },

  // Create a new comment
  async createComment(data) {
    const [comment] = await db
      .insert(comments)
      .values({
        postId: data.page,
        userId: data.author,
        content: data.content,
        parentId: data.parent,
      })
      .returning();

    return {
      id: comment.id,
      page: comment.postId,
      author: comment.userId,
      content: comment.content,
      timestamp: comment.createdAt,
      parent: comment.parentId,
      likes: 0,
      dislikes: 0,
    };
  },

  // Update a comment
  async updateComment(id, data) {
    await db
      .update(comments)
      .set({
        content: data.content,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, id));
  },

  // Delete a comment (soft delete)
  async deleteComment(id) {
    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, id));
  },

  // Rate a comment
  async setRate(commentId, author, like) {
    if (like === null) {
      // Remove rate
      await db
        .delete(commentRates)
        .where(
          and(
            eq(commentRates.commentId, commentId),
            eq(commentRates.userId, author)
          )
        );
    } else {
      // Upsert rate
      await db
        .insert(commentRates)
        .values({
          commentId,
          userId: author,
          like: like ? "like" : "dislike",
        })
        .onConflictDoUpdate({
          target: [commentRates.commentId, commentRates.userId],
          set: { like: like ? "like" : "dislike" },
        });
    }
  },

  // Get user's rate on a comment
  async getRate(commentId, author) {
    const rate = await db.query.commentRates.findFirst({
      where: and(
        eq(commentRates.commentId, commentId),
        eq(commentRates.userId, author)
      ),
    });

    if (!rate) return null;
    return rate.like === "like";
  },
};
```

## API Route Handler

### Route Configuration

```typescript
// app/api/comments/[...comment]/route.ts
import { createRouteHandler } from "@fuma-comment/server";
import { commentAdapter } from "@/lib/comments/adapter";
import { auth } from "@/lib/auth"; // better-auth instance
import { headers } from "next/headers";

const handler = createRouteHandler({
  adapter: commentAdapter,

  // Authentication
  auth: async () => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null; // Not authenticated
    }

    return {
      id: session.user.id,
      name: session.user.name || "Anonymous",
      image: session.user.image,
    };
  },

  // Optional: Rate limiting
  rateLimit: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
  },

  // Optional: Content moderation
  onCommentCreate: async (comment) => {
    // Check for spam, profanity, etc.
    const isSpam = await checkForSpam(comment.content);
    if (isSpam) {
      throw new Error("Comment flagged as spam");
    }
  },
});

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
```

## Client Component

### Basic Usage

```typescript
// components/blog/comments.tsx
"use client";

import { Comments } from "@fuma-comment/react";
import "@fuma-comment/react/style.css";

interface CommentsProps {
  postId: string;
}

export function BlogComments({ postId }: CommentsProps) {
  return (
    <div className="mt-12 pt-8 border-t">
      <h2 className="text-2xl font-bold mb-6">Comments</h2>
      <Comments page={postId} />
    </div>
  );
}
```

### Customized Usage

```typescript
// components/blog/comments.tsx
"use client";

import { Comments, CommentsProvider } from "@fuma-comment/react";
import "@fuma-comment/react/style.css";
import { useTheme } from "next-themes";

interface CommentsProps {
  postId: string;
}

export function BlogComments({ postId }: CommentsProps) {
  const { theme } = useTheme();

  return (
    <div className="mt-12 pt-8 border-t">
      <h2 className="text-2xl font-bold mb-6">Comments</h2>

      <CommentsProvider
        page={postId}
        className={theme === "dark" ? "dark" : ""}
      >
        <Comments
          // Custom strings
          strings={{
            placeholder: "Share your thoughts...",
            submit: "Post Comment",
            reply: "Reply",
            edit: "Edit",
            delete: "Delete",
            cancel: "Cancel",
            login: "Sign in to comment",
            noComments: "Be the first to comment!",
          }}

          // Show login prompt for unauthenticated users
          onAuthRequired={() => {
            window.location.href = "/login?redirect=" + window.location.pathname;
          }}
        />
      </CommentsProvider>
    </div>
  );
}
```

### Custom Styling

```css
/* styles/comments.css */

/* Override default styles */
.fuma-comment {
  --fc-background: hsl(var(--background));
  --fc-foreground: hsl(var(--foreground));
  --fc-muted: hsl(var(--muted));
  --fc-muted-foreground: hsl(var(--muted-foreground));
  --fc-border: hsl(var(--border));
  --fc-primary: hsl(var(--primary));
  --fc-primary-foreground: hsl(var(--primary-foreground));
  --fc-radius: var(--radius);
}

/* Comment container */
.fuma-comment-root {
  @apply space-y-4;
}

/* Single comment */
.fuma-comment-item {
  @apply rounded-lg border bg-card p-4;
}

/* Comment author */
.fuma-comment-author {
  @apply flex items-center gap-2 mb-2;
}

.fuma-comment-author-avatar {
  @apply w-8 h-8 rounded-full;
}

.fuma-comment-author-name {
  @apply font-medium;
}

/* Comment content */
.fuma-comment-content {
  @apply text-sm leading-relaxed;
}

/* Comment actions */
.fuma-comment-actions {
  @apply flex items-center gap-4 mt-3 text-sm text-muted-foreground;
}

/* Textarea */
.fuma-comment-textarea {
  @apply w-full min-h-[100px] rounded-lg border bg-background p-3 text-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-ring;
}

/* Submit button */
.fuma-comment-submit {
  @apply inline-flex items-center justify-center rounded-md bg-primary px-4 py-2;
  @apply text-sm font-medium text-primary-foreground;
  @apply hover:bg-primary/90 transition-colors;
}

/* Reply thread */
.fuma-comment-replies {
  @apply ms-8 mt-4 space-y-4 border-s-2 ps-4;
}
```

## Usage in Blog Post

```typescript
// app/blog/[slug]/page.tsx
import { blogSource } from "@/lib/source";
import { notFound } from "next/navigation";
import { MDXContent } from "fumadocs-ui/mdx";
import { BlogComments } from "@/components/blog/comments";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogSource.getPage([slug]);

  if (!post) notFound();

  const MDX = post.data.body;

  return (
    <article className="container py-12">
      <header>
        <h1 className="text-4xl font-bold">{post.data.title}</h1>
      </header>

      <div className="prose dark:prose-invert max-w-none mt-8">
        <MDXContent>
          <MDX />
        </MDXContent>
      </div>

      {/* Comments section */}
      <BlogComments postId={slug} />
    </article>
  );
}
```

## Authentication Integration

### With better-auth

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

### Auth Check in Component

```typescript
// components/blog/comments.tsx
"use client";

import { Comments } from "@fuma-comment/react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function BlogComments({ postId }: { postId: string }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <CommentsSkeleton />;
  }

  return (
    <div className="mt-12 pt-8 border-t">
      <h2 className="text-2xl font-bold mb-6">Comments</h2>

      {!session ? (
        <div className="text-center py-8 bg-muted rounded-lg">
          <p className="text-muted-foreground mb-4">
            Sign in to join the discussion
          </p>
          <Button asChild>
            <Link href={`/login?redirect=/blog/${postId}`}>Sign In</Link>
          </Button>
        </div>
      ) : (
        <Comments page={postId} />
      )}
    </div>
  );
}
```

## Moderation

### Basic Moderation

```typescript
// lib/comments/moderation.ts
const BLOCKED_WORDS = ["spam", "badword"];
const URL_PATTERN = /https?:\/\/[^\s]+/gi;

export async function moderateComment(content: string): Promise<{
  approved: boolean;
  reason?: string;
}> {
  // Check for blocked words
  const lowerContent = content.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lowerContent.includes(word)) {
      return { approved: false, reason: "Contains blocked words" };
    }
  }

  // Check for too many URLs
  const urls = content.match(URL_PATTERN) || [];
  if (urls.length > 2) {
    return { approved: false, reason: "Too many links" };
  }

  // Check minimum length
  if (content.trim().length < 2) {
    return { approved: false, reason: "Comment too short" };
  }

  return { approved: true };
}
```

### Integrate with Route Handler

```typescript
// app/api/comments/[...comment]/route.ts
import { moderateComment } from "@/lib/comments/moderation";

const handler = createRouteHandler({
  adapter: commentAdapter,
  auth: async () => { /* ... */ },

  onCommentCreate: async (comment) => {
    const result = await moderateComment(comment.content);
    if (!result.approved) {
      throw new Error(result.reason || "Comment not approved");
    }
  },
});
```

## Best Practices

1. **Rate limiting** - Prevent spam with request limits
2. **Soft deletes** - Keep records for moderation history
3. **Content moderation** - Filter inappropriate content
4. **Nested replies** - Limit nesting depth (2-3 levels)
5. **Real-time updates** - Consider WebSocket for live comments
6. **Loading states** - Show skeletons while fetching
7. **Error handling** - Display user-friendly error messages
8. **Accessibility** - Ensure keyboard navigation works
