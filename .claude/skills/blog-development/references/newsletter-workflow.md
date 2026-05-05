# Newsletter Workflow with Resend

Complete guide for implementing email newsletters in Next.js blogs.

## Setup

### Installation

```bash
npm install resend @react-email/components
npm install -D react-email
```

### Environment Variables

```bash
# .env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

## Database Schema

### Drizzle ORM Schema

```typescript
// lib/db/schema.ts
import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const subscribers = pgTable("subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  confirmedAt: timestamp("confirmed_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const broadcasts = pgTable("broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  postSlug: text("post_slug").notNull().unique(),
  subject: text("subject").notNull(),
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailEvents = pgTable("email_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  broadcastId: uuid("broadcast_id")
    .notNull()
    .references(() => broadcasts.id),
  subscriberId: uuid("subscriber_id")
    .notNull()
    .references(() => subscribers.id),
  event: text("event").notNull(), // 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});
```

## Subscribe Flow

### Server Action

```typescript
// app/newsletter/actions.ts
"use server";

import { db } from "@/lib/db";
import { subscribers } from "@/lib/db/schema";
import { Resend } from "resend";
import { WelcomeEmail } from "@/emails/welcome";
import { ConfirmationEmail } from "@/emails/confirmation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const resend = new Resend(process.env.RESEND_API_KEY);

const subscribeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1).optional(),
});

export type SubscribeState = {
  success?: boolean;
  error?: string;
};

export async function subscribe(
  _prevState: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const result = subscribeSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
  });

  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const { email, name } = result.data;

  try {
    // Check if already subscribed
    const existing = await db.query.subscribers.findFirst({
      where: eq(subscribers.email, email),
    });

    if (existing) {
      if (existing.unsubscribedAt) {
        // Re-subscribe
        await db
          .update(subscribers)
          .set({
            unsubscribedAt: null,
            confirmedAt: new Date(),
            name: name || existing.name,
            updatedAt: new Date(),
          })
          .where(eq(subscribers.id, existing.id));
      } else if (existing.confirmedAt) {
        return { error: "You're already subscribed!" };
      } else {
        // Resend confirmation email
        await sendConfirmationEmail(email, name);
        return { success: true };
      }
    } else {
      // Create new subscriber (unconfirmed)
      const token = nanoid(32);
      await db.insert(subscribers).values({
        email,
        name,
        // Store confirmation token in a separate table or use JWT
      });

      // Send confirmation email
      await sendConfirmationEmail(email, name, token);
    }

    return { success: true };
  } catch (error) {
    console.error("Subscribe error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

async function sendConfirmationEmail(email: string, name?: string, token?: string) {
  const confirmUrl = `${process.env.SITE_URL}/newsletter/confirm?token=${token}`;

  await resend.emails.send({
    from: "ServerlessBase <newsletter@serverlessbase.com>",
    to: email,
    subject: "Confirm your subscription",
    react: ConfirmationEmail({ name, confirmUrl }),
  });
}
```

### Subscribe Form Component

```typescript
// components/blog/newsletter-form.tsx
"use client";

import { useActionState } from "react";
import { subscribe, type SubscribeState } from "@/app/newsletter/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Loader2, Mail } from "lucide-react";

const initialState: SubscribeState = {};

export function NewsletterForm() {
  const [state, formAction, isPending] = useActionState(subscribe, initialState);

  if (state.success) {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <CheckCircle className="h-5 w-5" />
        <span>Check your inbox to confirm your subscription!</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            disabled={isPending}
            className="ps-10"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
              Subscribing...
            </>
          ) : (
            "Subscribe"
          )}
        </Button>
      </div>

      {state.error && (
        <p className="text-sm text-red-500 dark:text-red-400">{state.error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        No spam, unsubscribe at any time.
      </p>
    </form>
  );
}
```

## Email Templates

### Welcome Email

```typescript
// emails/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  name?: string;
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  const previewText = "Welcome to the ServerlessBase newsletter";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://serverlessbase.com/logo.png"
            width="120"
            height="40"
            alt="ServerlessBase"
            style={logo}
          />

          <Heading style={heading}>Welcome to ServerlessBase!</Heading>

          <Text style={paragraph}>Hi {name || "there"},</Text>

          <Text style={paragraph}>
            Thank you for subscribing to our newsletter! You'll receive the
            latest articles about deployment, serverless architecture, and
            DevOps best practices directly in your inbox.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href="https://serverlessbase.com/blog">
              Read Latest Posts
            </Button>
          </Section>

          <Text style={paragraph}>
            Here's what you can expect:
          </Text>

          <ul style={list}>
            <li style={listItem}>📚 Weekly tutorials and guides</li>
            <li style={listItem}>🚀 New feature announcements</li>
            <li style={listItem}>💡 Tips and best practices</li>
            <li style={listItem}>🎯 Exclusive content for subscribers</li>
          </ul>

          <Text style={paragraph}>
            Happy deploying!
            <br />
            The ServerlessBase Team
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you subscribed to ServerlessBase.
              <br />
              <Link href="https://serverlessbase.com/unsubscribe" style={link}>
                Unsubscribe
              </Link>
              {" · "}
              <Link href="https://serverlessbase.com" style={link}>
                Website
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  borderRadius: "8px",
  maxWidth: "600px",
};

const logo = {
  margin: "0 auto 24px",
  display: "block",
};

const heading = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const paragraph = {
  color: "#4b5563",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 16px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "14px 28px",
  display: "inline-block",
};

const list = {
  color: "#4b5563",
  fontSize: "16px",
  lineHeight: "26px",
  paddingLeft: "20px",
  margin: "0 0 24px",
};

const listItem = {
  margin: "8px 0",
};

const footer = {
  borderTop: "1px solid #e5e7eb",
  marginTop: "32px",
  paddingTop: "24px",
};

const footerText = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "20px",
  textAlign: "center" as const,
};

const link = {
  color: "#6b7280",
  textDecoration: "underline",
};

export default WelcomeEmail;
```

### New Post Email

```typescript
// emails/new-post.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface NewPostEmailProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  author: string;
  unsubscribeUrl: string;
}

export function NewPostEmail({
  title,
  description,
  url,
  image,
  author,
  unsubscribeUrl,
}: NewPostEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://serverlessbase.com/logo.png"
            width="120"
            height="40"
            alt="ServerlessBase"
            style={logo}
          />

          <Text style={eyebrow}>New Post</Text>

          <Heading style={heading}>{title}</Heading>

          {image && (
            <Img
              src={image}
              width="560"
              height="315"
              alt={title}
              style={heroImage}
            />
          )}

          <Text style={paragraph}>{description}</Text>

          <Text style={authorText}>By {author}</Text>

          <Section style={buttonContainer}>
            <Button style={button} href={url}>
              Read Full Article
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this because you're subscribed to ServerlessBase.
              <br />
              <Link href={unsubscribeUrl} style={link}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ... styles similar to WelcomeEmail
```

## Broadcast Script

### Send Broadcast

```typescript
// scripts/send-broadcast.ts
import { db } from "@/lib/db";
import { broadcasts, subscribers, emailEvents } from "@/lib/db/schema";
import { blogSource } from "@/lib/source";
import { Resend } from "resend";
import { NewPostEmail } from "@/emails/new-post";
import { eq, and, isNotNull, isNull } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);
const BATCH_SIZE = 100;
const DELAY_MS = 1000;

async function sendBroadcast(postSlug: string) {
  console.log(`Starting broadcast for: ${postSlug}`);

  // Check if already sent
  const existing = await db.query.broadcasts.findFirst({
    where: eq(broadcasts.postSlug, postSlug),
  });

  if (existing?.sentAt) {
    console.log(`Broadcast already sent at ${existing.sentAt}`);
    return;
  }

  // Get post data
  const post = blogSource.getPage([postSlug]);
  if (!post) {
    throw new Error(`Post not found: ${postSlug}`);
  }

  const { title, description, author, image } = post.data;
  const url = `https://serverlessbase.com/blog/${postSlug}`;

  // Get active subscribers
  const activeSubscribers = await db.query.subscribers.findMany({
    where: and(
      isNotNull(subscribers.confirmedAt),
      isNull(subscribers.unsubscribedAt)
    ),
  });

  if (activeSubscribers.length === 0) {
    console.log("No active subscribers");
    return;
  }

  console.log(`Sending to ${activeSubscribers.length} subscribers`);

  // Create or update broadcast record
  let broadcastId: string;
  if (existing) {
    broadcastId = existing.id;
  } else {
    const [broadcast] = await db
      .insert(broadcasts)
      .values({
        postSlug,
        subject: title,
      })
      .returning();
    broadcastId = broadcast.id;
  }

  // Send in batches
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < activeSubscribers.length; i += BATCH_SIZE) {
    const batch = activeSubscribers.slice(i, i + BATCH_SIZE);

    try {
      const results = await resend.batch.send(
        batch.map((subscriber) => ({
          from: "ServerlessBase <newsletter@serverlessbase.com>",
          to: subscriber.email,
          subject: `New: ${title}`,
          react: NewPostEmail({
            title,
            description,
            url,
            image,
            author,
            unsubscribeUrl: `https://serverlessbase.com/unsubscribe?email=${subscriber.email}`,
          }),
        }))
      );

      // Record events
      for (let j = 0; j < batch.length; j++) {
        await db.insert(emailEvents).values({
          broadcastId,
          subscriberId: batch[j].id,
          event: results.data?.[j]?.id ? "sent" : "failed",
        });
      }

      sentCount += batch.length;
      console.log(`Progress: ${sentCount}/${activeSubscribers.length}`);
    } catch (error) {
      console.error(`Batch failed:`, error);
      failedCount += batch.length;
    }

    // Rate limiting delay
    if (i + BATCH_SIZE < activeSubscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  // Update broadcast record
  await db
    .update(broadcasts)
    .set({
      sentAt: new Date(),
      recipientCount: sentCount,
    })
    .where(eq(broadcasts.id, broadcastId));

  console.log(`Broadcast complete: ${sentCount} sent, ${failedCount} failed`);
}

// CLI usage
const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npx tsx scripts/send-broadcast.ts <post-slug>");
  process.exit(1);
}

sendBroadcast(slug)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## Unsubscribe Flow

### Unsubscribe Page

```typescript
// app/unsubscribe/page.tsx
import { db } from "@/lib/db";
import { subscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface Props {
  searchParams: Promise<{ email?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { email } = await searchParams;

  if (!email) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Invalid Request</h1>
        <p>No email address provided.</p>
      </div>
    );
  }

  // Update subscriber
  await db
    .update(subscribers)
    .set({ unsubscribedAt: new Date() })
    .where(eq(subscribers.email, email));

  return (
    <div className="container py-12 text-center">
      <h1 className="text-2xl font-bold mb-4">Unsubscribed</h1>
      <p className="text-muted-foreground mb-6">
        You've been unsubscribed from the ServerlessBase newsletter.
      </p>
      <p className="text-sm text-muted-foreground">
        Changed your mind?{" "}
        <a href="/newsletter" className="text-primary underline">
          Resubscribe
        </a>
      </p>
    </div>
  );
}
```

## Best Practices

1. **Double opt-in** - Send confirmation email before adding to list
2. **Clear unsubscribe** - One-click unsubscribe in every email
3. **Rate limiting** - Don't exceed Resend's rate limits
4. **Error handling** - Track failed sends and retry
5. **Analytics** - Monitor open rates and clicks
6. **Segmentation** - Allow subscribers to choose content types
7. **Testing** - Preview emails before sending broadcasts
