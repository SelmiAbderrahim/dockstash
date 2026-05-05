---
name: websmith
description: Comprehensive guide for the WebSmith AI Website Builder on ServerlessBase. Use when building or modifying WebSmith features including website cloning, AI code generation, Docker sandbox management, chat interfaces, and project deployment. Covers both clone mode (from URL) and create mode (from scratch via prompting).
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "ai-website-builder"
  dependencies: "firecrawl, vercel-ai-sdk, docker, react, vite"
  project: "ServerlessBase - WebSmith AI Website Builder"
---

# WebSmith AI Website Builder Development Guide

## Overview

WebSmith is an AI-powered website builder integrated into the ServerlessBase deployment platform. It enables users to build websites through two modes:

1. **Clone Mode**: Provide a URL, WebSmith scrapes it using Firecrawl, then AI generates equivalent React code in a Docker sandbox with live preview.
2. **Create Mode**: Describe a website in natural language, AI generates React code from scratch in a Docker sandbox with live preview.

The builder features a 3-panel layout (chat + code editor + live preview), streaming AI responses, and one-click deployment to production servers with custom domain support.

**Keywords**: websmith, website builder, clone website, AI builder, sandbox, live preview, scrape website, firecrawl, ai code generation, docker sandbox, website cloner

**Project Context**: React 18 + TypeScript strict + TanStack Router + TanStack Query + Shadcn UI, tRPC backend with Drizzle ORM + PostgreSQL, Docker sandboxes for live preview.

## When to Use This Skill

- **WebSmith Features**: When building or modifying any WebSmith functionality
- **Website Cloning**: When implementing URL scraping and code generation from existing sites
- **Website Creation**: When implementing AI-driven website creation from prompts
- **Docker Sandbox**: When managing sandbox container lifecycle, ports, or file operations
- **AI Generation**: When implementing streaming code generation with Vercel AI SDK
- **Builder UI**: When creating or modifying the 3-panel builder layout
- **Chat Interface**: When building the conversational AI interface
- **Project Management**: When implementing project CRUD, export, or deployment
- **Firecrawl Integration**: When working with website scraping capabilities
- **Usage Tracking**: When implementing per-user usage limits and billing

## Architecture Overview

### System Architecture

```
+-----------------------------------------------------------------------+
|                         WebSmith Architecture                          |
+-----------------------------------------------------------------------+
|                                                                        |
|  +-------------------------------+   +------------------------------+  |
|  |      Chat Interface           |   |       Code Editor            |  |
|  |  - User messages              |   |  - File tree sidebar         |  |
|  |  - AI streaming responses     |   |  - Syntax highlighting       |  |
|  |  - File change indicators     |   |  - Read-only view            |  |
|  +-------------------------------+   +------------------------------+  |
|                                                                        |
|  +------------------------------------------------------------------+  |
|  |                     Live Preview Panel                            |  |
|  |  - Iframe rendering Docker sandbox URL                            |  |
|  |  - Responsive mode toggle (desktop/tablet/mobile)                 |  |
|  |  - Sandbox status indicator                                       |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
+-----------------------------------------------------------------------+
                                 |
                     tRPC API Layer (streaming)
                                 |
+-----------------------------------------------------------------------+
|                          Backend Services                              |
+-----------------------------------------------------------------------+
|                                                                        |
|  +-----------------+  +------------------+  +----------------------+   |
|  | Scraping Service|  | AI Generation    |  | Docker Sandbox       |   |
|  | (Firecrawl API) |  | (Claude/GPT/etc) |  | Provider             |   |
|  |                 |  | Clone + Create   |  | (Container lifecycle)|   |
|  +-----------------+  +------------------+  +----------------------+   |
|                                                                        |
|  +-----------------+  +------------------+  +----------------------+   |
|  | Chat Session    |  | Usage Tracking   |  | Deploy to Server     |   |
|  | Management      |  | (Per-user limits)|  | (+ Custom Domains)   |   |
|  +-----------------+  +------------------+  +----------------------+   |
|                                                                        |
+-----------------------------------------------------------------------+
                                 |
                          PostgreSQL + Docker
```

### Project Structure

```
serverlessbase/packages/server/src/
├── db/schema/
│   └── websmith.ts                    # Database schema (projects, sessions, messages, sandboxes, usage)
├── services/
│   ├── websmith/
│   │   ├── sandbox-provider.ts        # Docker container lifecycle
│   │   ├── scraping-service.ts        # Firecrawl integration
│   │   ├── ai-generation-service.ts   # Vercel AI SDK streaming
│   │   ├── chat-session-service.ts    # Session and message management
│   │   ├── usage-tracking-service.ts  # Per-user usage recording
│   │   └── deploy-service.ts          # Sandbox -> production deploy
│   └── ...
└── api/routers/
    └── websmith.ts                    # tRPC router procedures

client/src/
├── routes/_app/_auth/dashboard/
│   ├── websmith/
│   │   ├── index.tsx                  # Project list page
│   │   └── $projectId.tsx             # Builder page
├── components/dashboard/websmith/
│   ├── project-list.tsx               # Table view of projects
│   ├── builder-layout.tsx             # 3-panel ResizablePanelGroup
│   ├── chat-panel.tsx                 # Chat interface with streaming
│   ├── editor-panel.tsx               # File tree + code viewer
│   ├── preview-panel.tsx              # Iframe + responsive controls
│   ├── url-input.tsx                  # Clone mode URL entry
│   ├── create-dialog.tsx              # Create mode project setup
│   ├── model-selector.tsx             # AI model picker
│   └── deploy-dialog.tsx              # Deploy to server
├── services/websmith/
│   ├── websmithService.ts             # tRPC API calls
│   └── index.ts
├── hooks/websmith/
│   ├── queryKeys.ts                   # React Query key factory
│   ├── useWebsmithProjects.ts         # Project CRUD hooks
│   ├── useWebsmithChat.ts             # Chat and streaming hooks
│   ├── useWebsmithSandbox.ts          # Sandbox status hooks
│   └── index.ts
└── types/
    └── websmith.ts                    # TypeScript types
```

### Data Flow

```
Clone Mode:
  URL Input → Firecrawl Scrape → HTML/CSS/Metadata
       ↓
  AI Generation (streaming) → React/Vite Code
       ↓
  Docker Sandbox → Install Deps → Vite Dev Server → Live Preview
       ↓
  User Refines via Chat → AI Updates Code → Preview Refreshes
       ↓
  Deploy → Application Record → Custom Domain

Create Mode:
  Natural Language Prompt → AI Generation (streaming) → React/Vite Code
       ↓
  Docker Sandbox → Install Deps → Vite Dev Server → Live Preview
       ↓
  User Refines via Chat → AI Updates Code → Preview Refreshes
       ↓
  Deploy → Application Record → Custom Domain
```

## Two Operating Modes

### Clone Mode

1. User enters a URL in the builder
2. Backend calls Firecrawl API to scrape the website (HTML, CSS, metadata, screenshot)
3. Scraped content is sent to AI with a clone-specific system prompt
4. AI generates equivalent React + Tailwind code in streaming fashion
5. Generated files are written to Docker sandbox
6. Vite dev server starts, preview iframe loads sandbox URL
7. User can refine via chat ("make the header sticky", "change colors to blue")

### Create Mode

1. User describes what they want ("a SaaS landing page with pricing table")
2. Description is sent to AI with a create-specific system prompt
3. AI generates React + Tailwind code from scratch in streaming fashion
4. Generated files are written to Docker sandbox
5. Vite dev server starts, preview iframe loads sandbox URL
6. User can refine via chat ("add a testimonials section", "make it responsive")

## Docker Sandbox Lifecycle

### Container Configuration

| Property | Value |
|----------|-------|
| Base Image | `node:22-slim` with Vite pre-installed |
| Container Name | `serverless-websmith-sandbox-{sessionId}` |
| Network | `serverless-network` |
| Port Range | Dynamic: 49000-49999 |
| Default Timeout | 15 minutes |
| Working Directory | `/app` |
| Auto-Cleanup | Cron removes expired containers |

### Lifecycle States

```
CREATING → RUNNING → IDLE → EXPIRED → DESTROYED
                 ↑         ↓
                 └─ ACTIVE ←┘ (user interaction resets timer)
```

### Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Create | `createSandbox(projectId)` | Pull image, create container, allocate port |
| Write File | `writeFile(sandboxId, path, content)` | Write file via `docker exec` |
| Read File | `readFile(sandboxId, path)` | Read file via `docker exec` |
| List Files | `listFiles(sandboxId, dir)` | List directory via `docker exec` |
| Execute | `execCommand(sandboxId, cmd)` | Run command (npm install, etc.) |
| Start Dev | `startDevServer(sandboxId)` | Run `vite --host 0.0.0.0` |
| Destroy | `destroySandbox(sandboxId)` | Stop and remove container |
| Extend | `extendTimeout(sandboxId)` | Reset expiry timer |

## AI Generation

### Provider Integration

WebSmith reuses existing AI provider keys configured in **Dashboard > Settings > AI Assistants**. No separate configuration needed.

| Provider | SDK Package | Models |
|----------|-------------|--------|
| Anthropic | `@ai-sdk/anthropic` | Claude Sonnet 4, Claude Opus 4 |
| OpenAI | `@ai-sdk/openai` | GPT-4o, GPT-4o-mini |
| Google | `@ai-sdk/google` | Gemini 2.0 Flash, Gemini 2.5 Pro |
| Groq | `@ai-sdk/groq` | Llama 3.3, Mixtral |

### Streaming Pattern

```typescript
import { streamText } from 'ai';

// tRPC streaming mutation
const stream = streamText({
  model: getModelInstance(providerId, modelId),
  system: getSystemPrompt(mode, scrapedContent),
  messages: conversationHistory,
  maxTokens: 8192,
  onFinish: async (result) => {
    await recordUsage(userId, result.usage);
    await saveMessage(sessionId, 'assistant', result.text);
  },
});
```

### System Prompts

| Mode | Prompt Focus |
|------|-------------|
| Clone | "Recreate this website as a React + Tailwind app. Match the layout, colors, and functionality." + scraped HTML/CSS/metadata |
| Create | "Build a React + Tailwind website based on this description. Use modern design patterns." + user description |
| Refine | "Update the existing code based on this request. Only modify what's needed." + current file context |

## Firecrawl Integration

### Configuration

Firecrawl API key is stored as a provider type in the existing AI Assistants settings page. It is **NOT** a separate settings section.

```typescript
// Query Firecrawl key via existing AI config service
const firecrawlKey = await getAiProviderKey(userId, 'firecrawl');
```

### Scraping Output

```typescript
interface ScrapeResult {
  html: string;           // Full page HTML
  css: string[];          // Extracted stylesheets
  metadata: {
    title: string;
    description: string;
    favicon: string;
    ogImage: string;
  };
  screenshot: string;     // Base64 page screenshot
  links: string[];        // Internal links found
}
```

## Deploy Workflow

1. User clicks "Deploy" in builder
2. Backend creates an `application` record in existing applications table
3. `websmithProject.applicationId` is set (FK link)
4. Sandbox files are copied to application container
5. Production build runs (`vite build`)
6. Application is deployed using existing deployment pipeline
7. User can add custom domain using existing domain management UI

## tRPC Router Procedures

### websmith Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `project.list` | query | List user's WebSmith projects |
| `project.one` | query | Get project by ID |
| `project.create` | mutation | Create new project (clone or create mode) |
| `project.update` | mutation | Update project name/settings |
| `project.delete` | mutation | Delete project and sandbox |
| `project.export` | mutation | Export project as ZIP |
| `session.one` | query | Get current session with messages |
| `session.create` | mutation | Create new chat session |
| `chat.send` | mutation (streaming) | Send message, get AI streaming response |
| `chat.history` | query | Get conversation history |
| `sandbox.status` | query | Get sandbox container status |
| `sandbox.create` | mutation | Create Docker sandbox |
| `sandbox.destroy` | mutation | Destroy sandbox container |
| `sandbox.extend` | mutation | Extend sandbox timeout |
| `sandbox.files` | query | List files in sandbox |
| `sandbox.readFile` | query | Read file from sandbox |
| `scrape.url` | mutation | Scrape URL via Firecrawl |
| `deploy.create` | mutation | Deploy project to server |
| `deploy.status` | query | Get deployment status |
| `usage.current` | query | Get current user's usage stats |
| `usage.limits` | query | Get plan usage limits |

## Frontend Components

### Builder Layout

Uses `ResizablePanelGroup` from Shadcn UI for the 3-panel layout:

```
+------------------+------------------+------------------+
|                  |                  |                  |
|   Chat Panel     |  Editor Panel    | Preview Panel    |
|   (25% default)  |  (35% default)   | (40% default)    |
|                  |                  |                  |
|  - Messages      |  - File tree     | - Iframe         |
|  - Input box     |  - Code viewer   | - Responsive     |
|  - Model select  |  - Syntax hl     |   mode toggle    |
|                  |                  | - Status badge   |
+------------------+------------------+------------------+
```

### Component Hierarchy

```
WebSmithBuilderPage
├── BuilderLayout (ResizablePanelGroup)
│   ├── ChatPanel
│   │   ├── MessageList (streaming messages)
│   │   ├── MessageInput (with URL input for clone mode)
│   │   └── ModelSelector (dropdown)
│   ├── EditorPanel
│   │   ├── FileTree (sidebar)
│   │   └── CodeViewer (syntax highlighted, read-only)
│   └── PreviewPanel
│       ├── PreviewToolbar (responsive modes, refresh)
│       ├── PreviewIframe (sandbox URL)
│       └── SandboxStatus (indicator)
├── DeployDialog
└── ExportButton
```

### Project List Page

Uses **table view** (NOT card grid) for design differentiation from main app:

| Column | Content |
|--------|---------|
| Name | Project name with mode icon |
| Mode | Clone / Create badge |
| Status | Draft / Deployed badge |
| Created | Relative time |
| Actions | Open, Deploy, Export, Delete (inline buttons) |

## Usage Tracking

### Tracked Metrics

| Metric | Description | Limit Type |
|--------|-------------|------------|
| `messageCount` | Total AI messages sent | Per month |
| `tokensUsed` | Total tokens consumed | Per month |
| `pagesCloned` | URLs scraped via Firecrawl | Per month |
| `sandboxMinutes` | Total sandbox runtime | Per month |
| `projectCount` | Active projects | Concurrent |

### Recording Pattern

```typescript
// After each AI response
await usageTrackingService.record(userId, {
  type: 'ai_message',
  tokensInput: result.usage.promptTokens,
  tokensOutput: result.usage.completionTokens,
  model: modelId,
  provider: providerId,
});
```

## Troubleshooting Guide

### Sandbox Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Sandbox not starting | Port conflict | Check `docker ps` for port range 49000-49999 |
| Preview not loading | Vite not started | Check sandbox logs with `docker logs` |
| Files not updating | Container paused | Extend timeout, check container status |
| Sandbox expired | Inactivity timeout | Create new sandbox, files are preserved in DB |

### AI Generation Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| No response | Missing API key | Check AI provider settings |
| Incomplete code | Token limit | Increase maxTokens or use continuation |
| Wrong framework | System prompt | Verify clone/create mode prompt |
| Streaming fails | Network timeout | Check tRPC streaming configuration |

### Scraping Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Scrape fails | Invalid URL | Validate URL format |
| Empty result | Site blocks scraping | Try different Firecrawl mode |
| Missing styles | Dynamic content | Use screenshot mode for reference |
| Rate limited | Too many requests | Check Firecrawl plan limits |

### Session Creation Troubleshooting

#### Timeout During Session Creation

**Symptoms**: `session.create` hangs or returns a generic timeout error.

**Causes**:
1. Default HTTP timeout too short for sandbox provisioning
2. Docker image pull takes too long (first use of `node:22-slim`)
3. npm install fails or hangs inside sandbox

**Fix**:
- `session.create` MUST have an explicit 120-second timeout (default HTTP timeouts are insufficient)
- Use streaming progress events to surface which step failed:

| Step | Progress | Message |
|------|----------|---------|
| `creating_sandbox` | 0% | Creating sandbox... |
| `installing_deps` | 25% | Installing dependencies... |
| `starting_server` | 60% | Starting dev server... |
| `verifying` | 85% | Verifying sandbox health... |
| `ready` | 100% | Ready! |

- If a step fails, the error MUST identify which step failed (not a generic timeout)

#### Port Exhaustion

**Symptoms**: Sandbox creation fails with "no available ports" or Docker bind error.

**Cause**: All ports in the 49000-49999 range are occupied by other sandbox containers.

**Diagnostic**:
```bash
docker ps --filter "name=serverless-websmith-sandbox" --format "{{.Ports}}" | wc -l
```

**Fix**:
- Run sandbox cleanup cron to remove expired containers
- Increase port range if consistently at capacity
- Check for leaked containers that weren't cleaned up

#### Docker Socket Unavailable

**Symptoms**: Container creation fails with permission denied or socket not found.

**Cause**: Main app container doesn't have access to Docker socket.

**Fix**: Verify Docker socket is mounted in the main-app container:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

#### npm Install Timeout Inside Sandbox

**Symptoms**: Session creation stalls at "Installing dependencies..." (25% progress).

**Fix**:
- Pre-cache common packages in the base image
- Increase the npm install timeout within the sandbox
- Check if the sandbox has network access (`serverless-network`)

## File Location Reference

| Layer | Location | Purpose |
|-------|----------|---------|
| Schema | `serverlessbase/packages/server/src/db/schema/websmith.ts` | Database tables |
| Services | `serverlessbase/packages/server/src/services/websmith/` | Backend business logic |
| Router | `serverlessbase/apps/serverlessbase/server/api/routers/websmith.ts` | tRPC procedures |
| Types | `client/src/types/websmith.ts` | Frontend TypeScript types |
| Services | `client/src/services/websmith/` | API call wrappers |
| Hooks | `client/src/hooks/websmith/` | React Query hooks |
| Components | `client/src/components/dashboard/websmith/` | UI components |
| Routes | `client/src/routes/_app/_auth/dashboard/websmith/` | Page routes |
| Translations | `client/public/locales/{lang}/websmith.json` | i18n strings |
| Feature Flag | `client/src/lib/features/platform-features.ts` | `WEBSMITH` flag |

## References

- Docker Sandbox Patterns: `references/docker-sandbox-patterns.md`
- AI Generation Patterns: `references/ai-generation-patterns.md`
- Firecrawl Integration: `references/firecrawl-integration.md`
- Builder UI Patterns: `references/builder-ui-patterns.md`
- WebSmith Prompts: `prompts/websmith/` (implementation guide)
