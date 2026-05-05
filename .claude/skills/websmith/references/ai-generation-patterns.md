# AI Generation Patterns - WebSmith Reference

## Overview

WebSmith uses the Vercel AI SDK for streaming code generation across multiple AI providers. Code generation supports two modes (clone and create) with iterative refinement via chat.

## Provider Integration

### Supported Providers

| Provider | SDK Package | Models |
|----------|-------------|--------|
| Anthropic | `@ai-sdk/anthropic` | Claude Sonnet 4, Claude Opus 4 |
| OpenAI | `@ai-sdk/openai` | GPT-4o, GPT-4o-mini |
| Google | `@ai-sdk/google` | Gemini 2.0 Flash, Gemini 2.5 Pro |
| Groq | `@ai-sdk/groq` | Llama 3.3 70B, Mixtral 8x7B |

### Key Reuse Pattern

WebSmith reuses existing AI provider keys from the `aiProvider` table. Keys are configured by the user in **Dashboard > Settings > AI Assistants**.

```typescript
import { getAiProvider } from '@/services/ai';

async function getModelInstance(providerId: string, modelId: string) {
  const provider = await getAiProvider(providerId);

  switch (provider.type) {
    case 'anthropic':
      return anthropic(modelId, { apiKey: provider.apiKey });
    case 'openai':
      return openai(modelId, { apiKey: provider.apiKey });
    case 'google':
      return google(modelId, { apiKey: provider.apiKey });
    case 'groq':
      return groq(modelId, { apiKey: provider.apiKey });
    default:
      throw new Error(`Unsupported provider: ${provider.type}`);
  }
}
```

## Streaming Pattern

### tRPC Streaming Mutation

```typescript
// serverlessbase/apps/serverlessbase/server/api/routers/websmith.ts
import { streamText } from 'ai';

export const websmithRouter = createTRPCRouter({
  'chat.send': protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      message: z.string(),
      modelId: z.string(),
      providerId: z.string(),
    }))
    .mutation(async function* ({ ctx, input }) {
      // 1. Save user message
      await saveMessage(input.sessionId, 'user', input.message);

      // 2. Get conversation context
      const messages = await getSessionMessages(input.sessionId);
      const session = await getSession(input.sessionId);
      const systemPrompt = getSystemPrompt(session.mode, session.scrapedContent);

      // 3. Start streaming
      const model = await getModelInstance(input.providerId, input.modelId);
      const stream = streamText({
        model,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        maxTokens: 8192,
      });

      // 4. Yield chunks as they arrive
      let fullResponse = '';
      for await (const chunk of stream.textStream) {
        fullResponse += chunk;
        yield { type: 'text' as const, content: chunk };
      }

      // 5. Save complete response
      await saveMessage(input.sessionId, 'assistant', fullResponse);

      // 6. Parse and apply file changes
      const fileChanges = parseFileChanges(fullResponse);
      yield { type: 'files' as const, changes: fileChanges };

      // 7. Record usage
      const usage = await stream.usage;
      await recordUsage(ctx.user.id, {
        type: 'ai_message',
        tokensInput: usage.promptTokens,
        tokensOutput: usage.completionTokens,
        model: input.modelId,
        provider: input.providerId,
      });

      yield { type: 'done' as const, usage };
    }),
});
```

### Frontend Streaming Hook

```typescript
// client/src/hooks/websmith/useWebsmithChat.ts
export function useWebsmithChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const sendMessage = useCallback(async (content: string, modelId: string, providerId: string) => {
    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content, timestamp: new Date() }]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const stream = await WebsmithService.sendMessage({
        sessionId,
        message: content,
        modelId,
        providerId,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          setStreamingContent(prev => prev + chunk.content);
        } else if (chunk.type === 'files') {
          // Handle file changes
          queryClient.invalidateQueries({
            queryKey: websmithKeys.sandboxes.files(sandboxId),
          });
        } else if (chunk.type === 'done') {
          // Finalize message
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: streamingContent,
            timestamp: new Date(),
          }]);
          setStreamingContent('');
        }
      }
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId]);

  return { messages, sendMessage, isStreaming, streamingContent };
}
```

## System Prompts

### Clone Mode System Prompt

```typescript
function getCloneSystemPrompt(scrapedContent: ScrapeResult): string {
  return `You are an expert web developer. Your task is to recreate a website as a modern React + Tailwind CSS application.

## Instructions
- Analyze the provided HTML, CSS, and metadata of the original website
- Recreate the website as a React application with Tailwind CSS
- Match the original layout, colors, typography, and functionality as closely as possible
- Use modern React patterns (functional components, hooks)
- Use Tailwind CSS for styling (no external CSS files)
- Make the site responsive
- Output complete file contents that can be directly written to the project

## Output Format
For each file, use this format:
\`\`\`filepath:/app/src/App.tsx
// file content here
\`\`\`

## Original Website Content
Title: ${scrapedContent.metadata.title}
Description: ${scrapedContent.metadata.description}

### HTML Structure
${scrapedContent.html}

### CSS Styles
${scrapedContent.css.join('\n')}

## Project Structure
The project uses:
- React 18 with TypeScript
- Vite as build tool
- Tailwind CSS for styling
- Entry point: /app/src/main.tsx
- App component: /app/src/App.tsx`;
}
```

### Create Mode System Prompt

```typescript
function getCreateSystemPrompt(): string {
  return `You are an expert web developer. Your task is to build a React + Tailwind CSS website from a natural language description.

## Instructions
- Build a complete, modern React application based on the user's description
- Use React 18 with TypeScript and functional components
- Use Tailwind CSS for all styling (no external CSS)
- Make the site fully responsive (mobile-first)
- Include appropriate sections, navigation, and layout
- Use professional design patterns and modern aesthetics
- Output complete file contents that can be directly written to the project

## Output Format
For each file, use this format:
\`\`\`filepath:/app/src/App.tsx
// file content here
\`\`\`

## Project Structure
The project uses:
- React 18 with TypeScript
- Vite as build tool
- Tailwind CSS for styling
- Entry point: /app/src/main.tsx
- App component: /app/src/App.tsx

Always start with App.tsx and create additional component files as needed.`;
}
```

### Refine Mode System Prompt

```typescript
function getRefineSystemPrompt(currentFiles: FileEntry[]): string {
  const fileList = currentFiles.map(f => `- ${f.path}`).join('\n');

  return `You are an expert web developer working on an existing React + Tailwind CSS project.

## Instructions
- The user will request changes to the existing website
- Only modify the files that need to change
- Preserve all existing functionality unless explicitly asked to remove it
- Use the same coding style as the existing codebase

## Output Format
For each file you need to modify, output the COMPLETE new file content:
\`\`\`filepath:/app/src/ComponentName.tsx
// complete new file content
\`\`\`

Only include files that need changes. Do not repeat unchanged files.

## Current Project Files
${fileList}`;
}
```

## File Change Parsing

### Parser

```typescript
interface FileChange {
  path: string;
  content: string;
  action: 'create' | 'update';
}

function parseFileChanges(response: string): FileChange[] {
  const changes: FileChange[] = [];
  const regex = /```filepath:(\/app\/[^\n]+)\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(response)) !== null) {
    changes.push({
      path: match[1],
      content: match[2].trim(),
      action: 'create', // or 'update' based on existing files
    });
  }

  return changes;
}
```

### Apply Changes to Sandbox

```typescript
async function applyFileChanges(sandboxId: string, changes: FileChange[]): Promise<void> {
  const sandbox = await getSandbox(sandboxId);

  for (const change of changes) {
    await sandboxProvider.writeFile(sandbox.containerId, change.path, change.content);
  }

  // Vite HMR will automatically pick up changes
}
```

## Context Management

### Conversation History

Messages are stored in `websmithMessage` table and loaded per session:

```typescript
async function getSessionMessages(sessionId: string): Promise<Message[]> {
  return db.query.websmithMessage.findMany({
    where: eq(websmithMessage.sessionId, sessionId),
    orderBy: asc(websmithMessage.createdAt),
  });
}
```

### Context Window Management

For long conversations, truncate early messages to stay within token limits:

```typescript
function truncateMessages(messages: Message[], maxTokens: number): Message[] {
  // Always keep system prompt and last N messages
  const keepLast = 10;
  if (messages.length <= keepLast) return messages;

  // Summarize older messages
  const recent = messages.slice(-keepLast);
  const summary = { role: 'system', content: 'Previous conversation summary: ...' };

  return [summary, ...recent];
}
```

## Token Counting and Usage

### Per-Request Recording

```typescript
async function recordUsage(userId: string, data: {
  type: 'ai_message' | 'scrape';
  tokensInput: number;
  tokensOutput: number;
  model: string;
  provider: string;
}): Promise<void> {
  await db.insert(websmithUsage).values({
    userId,
    ...data,
    totalTokens: data.tokensInput + data.tokensOutput,
    recordedAt: new Date(),
  });
}
```

### Usage Limits Check

```typescript
async function checkUsageLimits(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const currentMonth = startOfMonth(new Date());
  const usage = await db.query.websmithUsage.findFirst({
    where: and(
      eq(websmithUsage.userId, userId),
      gte(websmithUsage.recordedAt, currentMonth),
    ),
  });

  const limits = await getUserPlanLimits(userId);

  if (usage.messageCount >= limits.maxMessages) {
    return { allowed: false, reason: 'Monthly message limit reached' };
  }

  return { allowed: true };
}
```

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| API key invalid | Provider key expired/wrong | Show error, redirect to settings |
| Rate limited | Too many requests | Implement exponential backoff |
| Token limit exceeded | Response too large | Split generation into chunks |
| Stream interrupted | Network issue | Retry from last checkpoint |
| Model unavailable | Provider outage | Suggest alternative model |
