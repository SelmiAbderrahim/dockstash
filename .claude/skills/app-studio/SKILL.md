---
name: app-studio
description: Comprehensive guide for the App Studio AI App Builder on ServerlessBase. Use when building or modifying App Studio features including project management, AI agent mode, templates, themes, MCP integration, version control, and deployment.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "ai-app-builder"
  dependencies: "vercel-ai-sdk, docker, react, vite"
  project: "ServerlessBase - App Studio AI App Builder"
---

# App Studio AI App Builder Development Guide

## Overview

App Studio is an AI-powered application builder integrated into the ServerlessBase deployment platform. It enables users to build full React applications through conversational AI with three operating modes:

1. **Chat Mode**: Simple conversational AI for quick questions and guidance without tool calling.
2. **Agent Mode**: Full tool-calling AI that reads, writes, edits, searches, and executes commands inside a Docker sandbox with live preview.
3. **Plan Mode**: AI generates an implementation plan for user approval before executing changes.

The builder features a 3-panel layout (chat + code editor with console + live preview), streaming AI responses with tool call visualization, Git-based version control, template system, custom themes, MCP server integration, and one-click deployment.

**Keywords**: app studio, ai builder, agent mode, tool calling, sandbox, live preview, code generation, docker sandbox, version control, templates, themes, mcp, deployment

**Project Context**: React 18 + TypeScript strict + TanStack Router + TanStack Query + Shadcn UI, tRPC backend with Drizzle ORM + PostgreSQL, Docker sandboxes for live preview, Vercel AI SDK for streaming.

## When to Use This Skill

- **App Studio Features**: When building or modifying any App Studio functionality
- **Agent Mode**: When implementing AI tool calling, context building, or multi-step workflows
- **Docker Sandbox**: When managing sandbox container lifecycle, ports, or file operations
- **AI Generation**: When implementing streaming code generation with Vercel AI SDK
- **Builder UI**: When creating or modifying the 3-panel builder layout
- **Chat Interface**: When building the conversational AI interface with tool call rendering
- **Project Management**: When implementing project CRUD, templates, or themes
- **Version Control**: When working with Git-based versioning inside sandboxes
- **MCP Integration**: When connecting external tool servers
- **Usage Tracking**: When implementing per-user usage limits and billing
- **Deployment**: When implementing sandbox-to-production deployment

## Architecture Overview

### System Architecture

```
+-----------------------------------------------------------------------+
|                        App Studio Architecture                         |
+-----------------------------------------------------------------------+
|                                                                        |
|  +-------------------------------+   +------------------------------+  |
|  |      Chat Panel               |   |       Editor Panel           |  |
|  |  - User messages              |   |  - File tree sidebar         |  |
|  |  - AI streaming responses     |   |  - Tabbed code viewer        |  |
|  |  - Tool call visualization    |   |  - Console panel (logs)      |  |
|  |  - Mode selector (3 modes)    |   |  - Syntax highlighting       |  |
|  |  - Thinking budget control    |   |  - Search dialog             |  |
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
|  | Agent Handler   |  | AI Streaming     |  | Docker Sandbox       |   |
|  | (tool calling)  |  | Service          |  | Provider             |   |
|  | maxSteps, ctx   |  | (Claude/GPT/etc) |  | (Container lifecycle)|   |
|  +-----------------+  +------------------+  +----------------------+   |
|                                                                        |
|  +-----------------+  +------------------+  +----------------------+   |
|  | Template Service|  | Theme Service    |  | Version Service      |   |
|  | (project init)  |  | (custom prompts) |  | (Git snapshots)      |   |
|  +-----------------+  +------------------+  +----------------------+   |
|                                                                        |
|  +-----------------+  +------------------+  +----------------------+   |
|  | MCP Service     |  | Usage Tracking   |  | Deploy Service       |   |
|  | (external tools)|  | (per-user limits)|  | (sandbox -> prod)    |   |
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
│   └── app-studio.ts                    # 11 tables + relations + Zod schemas
├── services/app-studio/
│   ├── sandbox-provider.ts              # Docker container lifecycle + file/git ops
│   ├── sandbox-cleanup.ts               # Cron-based expired container cleanup
│   ├── agent-tools.ts                   # 7 Vercel AI SDK tools for agent mode
│   ├── agent-handler.ts                 # Agent mode orchestrator (streaming + tools)
│   ├── agent-context.ts                 # Rich context builder (file tree, diff, pkg)
│   ├── ai-streaming-service.ts          # Chat/plan mode streaming
│   ├── project-service.ts               # Project CRUD
│   ├── chat-service.ts                  # Chat/message CRUD + compaction
│   ├── template-service.ts              # Built-in + custom templates
│   ├── version-service.ts               # Git commit + version snapshots
│   ├── theme-service.ts                 # Theme CRUD + AI theme generation
│   ├── mcp-service.ts                   # MCP server management + tool consent
│   ├── mcp-client.ts                    # MCP protocol client (SSE/HTTP)
│   ├── model-registry.ts               # AI model definitions + capabilities
│   ├── deploy-service.ts               # Sandbox -> application deployment
│   ├── usage-tracking.ts               # Per-user usage + quota enforcement
│   └── prompts/
│       ├── agent-prompt.ts              # Agent mode system prompt
│       ├── chat-prompt.ts               # Chat mode system prompt
│       ├── plan-prompt.ts               # Plan mode system prompt
│       ├── compaction-prompt.ts         # Context compaction prompt
│       └── index.ts                     # Prompt exports
└── api/routers/
    └── app-studio.ts                    # tRPC router procedures

client/src/
├── routes/_app/_auth/dashboard/
│   ├── _layout.app-studio.tsx           # App Studio layout route
│   ├── _layout.app-studio.index.tsx     # Project list page
│   ├── _layout.app-studio.$projectId.tsx           # Builder page
│   └── _layout.app-studio.$projectId.settings.tsx  # Project settings
├── components/dashboard/app-studio/
│   ├── project-list.tsx                 # Table view of projects
│   ├── create-project-dialog.tsx        # New project dialog
│   ├── project-status-badge.tsx         # Status badge component
│   ├── template-card.tsx                # Template display card
│   ├── builder/
│   │   ├── builder-layout.tsx           # 3-panel ResizablePanelGroup
│   │   ├── builder-header.tsx           # Header with project name + actions
│   │   ├── chat-panel.tsx               # Chat interface with streaming
│   │   ├── chat-input.tsx               # Message input with mode selector
│   │   ├── chat-message.tsx             # Message bubble rendering
│   │   ├── tool-call-display.tsx        # Tool call visualization
│   │   ├── editor-panel.tsx             # File tree + code viewer + console
│   │   ├── file-tree.tsx                # File tree sidebar
│   │   ├── file-tabs.tsx                # Open file tabs
│   │   ├── code-viewer.tsx              # Syntax highlighted code (read-only)
│   │   ├── console-panel.tsx            # Console output panel
│   │   ├── preview-panel.tsx            # Iframe + responsive controls
│   │   ├── sandbox-status.tsx           # Sandbox status indicator
│   │   ├── model-selector.tsx           # AI model picker
│   │   ├── mode-selector.tsx            # Chat/Agent/Plan mode picker
│   │   ├── thinking-budget.tsx          # Thinking token budget control
│   │   ├── action-sidebar.tsx           # Quick action sidebar
│   │   ├── version-list.tsx             # Version history panel
│   │   ├── search-dialog.tsx            # File search dialog
│   │   └── text-search.tsx              # In-file text search
│   ├── themes/
│   │   ├── theme-list.tsx               # Theme list view
│   │   ├── theme-selector.tsx           # Theme picker in builder
│   │   └── create-theme-dialog.tsx      # Create custom theme
│   ├── settings/
│   │   ├── general-tab.tsx              # Project general settings
│   │   ├── themes-tab.tsx               # Theme settings
│   │   ├── mcp-tab.tsx                  # MCP server configuration
│   │   └── env-tab.tsx                  # Environment variables
│   ├── deploy/
│   │   ├── deploy-dialog.tsx            # Deploy to server dialog
│   │   └── export-button.tsx            # Export project as ZIP
│   └── billing/
│       ├── upgrade-prompt.tsx           # Upgrade plan prompt
│       ├── usage-bar.tsx                # Usage progress bar
│       └── limit-reached-dialog.tsx     # Limit exceeded dialog
├── services/app-studio/
│   └── appStudioService.ts             # tRPC API calls
├── hooks/app-studio/
│   ├── queryKeys.ts                     # React Query key factory
│   ├── useProjects.ts                   # Project CRUD hooks
│   ├── useChats.ts                      # Chat and streaming hooks
│   ├── useSandbox.ts                    # Sandbox status hooks
│   ├── useVersions.ts                   # Version management hooks
│   ├── useThemes.ts                     # Theme hooks
│   ├── useTemplates.ts                  # Template hooks
│   ├── useUsage.ts                      # Usage tracking hooks
│   ├── useKeyboardShortcuts.ts          # Builder keyboard shortcuts
│   ├── useAppStudioPlanGate.ts          # Plan-based feature gating
│   └── index.ts
└── types/
    └── app-studio.ts                    # TypeScript types
```

### Data Flow

```
Create Mode:
  Select Template → Create Project → Docker Sandbox (Vite + React)
       ↓
  User Describes Feature → AI Agent Mode (streaming + tool calling)
       ↓
  Agent reads files → writes/edits code → runs commands → auto-commits
       ↓
  Live Preview updates via Vite HMR → User iterates
       ↓
  Deploy → Application Record → Custom Domain

Plan Mode:
  User Request → AI generates plan → User approves/rejects
       ↓
  Approved → Agent executes plan steps → Files modified → Auto-commit
       ↓
  Live Preview updates → Deploy when ready
```

## Three Operating Modes

### Chat Mode

Simple conversational AI without tool calling. Best for:
- Asking questions about the codebase
- Getting explanations of code patterns
- Quick guidance without modifications

### Agent Mode

Full tool-calling AI with 7 tools. The primary mode for building apps:
1. User describes what they want
2. AI reads existing code for context
3. AI writes/edits files, runs commands
4. Changes appear in live preview via Vite HMR
5. Auto-commits after each successful agent turn
6. User iterates via follow-up messages

### Plan Mode

Structured planning before execution:
1. User describes a feature or change
2. AI generates a detailed implementation plan
3. User reviews and approves/rejects
4. On approval, plan executes as agent steps

## Agent Mode Tools

### Tool Definitions

| Tool | Parameters | Description |
|------|-----------|-------------|
| `read_file` | `path` | Read file contents from sandbox |
| `write_file` | `path`, `content` | Create/replace file (base64 encoded) |
| `edit_file` | `path`, `oldText`, `newText` | Find-and-replace edit |
| `delete_file` | `path` | Remove a file |
| `run_shell` | `command` | Execute shell command (30s timeout) |
| `search_code` | `pattern`, `fileGlob?` | Grep across project files |
| `list_files` | `path?`, `recursive?` | List directory contents |

### Safety Rules

| Rule | Details |
|------|---------|
| Protected Files | `vite.config.ts`, `tsconfig.json`, `package.json`, `index.html`, etc. cannot be modified |
| Blocked Commands | `rm -rf /`, `shutdown`, `reboot`, `curl|bash`, fork bombs |
| Path Traversal | `..` in paths rejected by `validateSandboxPath()` |
| Output Truncation | Tool output capped at 10,000 characters |
| Shell Timeout | 30 seconds per command |
| Max Steps | Default 10 tool call rounds per message |
| Total Timeout | 5 minutes per agent message execution |

### Context Building

Before each agent message, `buildAgentContext()` gathers:
- File tree (up to 4 levels, excluding `node_modules` and `.git`)
- Recent git diff (uncommitted changes)
- Package.json info (dependencies, scripts)

This context is injected into the system prompt for richer AI understanding.

## Docker Sandbox Lifecycle

### Container Configuration

| Property | Value |
|----------|-------|
| Base Image | `node:22-slim` with Vite pre-installed |
| Container Name | `serverless-appstudio-sandbox-{projectId}` |
| Network | `serverless-network` |
| Port Range | Dynamic: 50000-50999 |
| Default Timeout | 30 minutes |
| Working Directory | `/app` |
| Memory Limit | 1 GB |
| CPU Limit | 1.0 cores |
| Auto-Cleanup | Cron removes expired containers |
| Git | Initialized at creation, auto-commits on changes |

### Lifecycle States

```
CREATING → RUNNING → IDLE → EXPIRED → DESTROYED
                 ↑         ↓
                 └─ ACTIVE ←┘ (user interaction resets timer)
```

### Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Create | `createSandbox(projectId)` | Pull image, create container, init project, git init, start Vite |
| Start | `startSandbox(sandboxId)` | Start stopped container, restart Vite |
| Stop | `stopSandbox(sandboxId)` | Stop container (preserves data) |
| Destroy | `destroySandbox(sandboxId)` | Stop + remove container |
| Write File | `writeFile(sandboxId, path, content)` | Write via base64 `docker exec` |
| Read File | `readFile(sandboxId, path)` | Read via `docker exec` |
| List Files | `listFiles(sandboxId, dir)` | List directory via `docker exec` |
| Exec Command | `execCommand(sandboxId, cmd)` | Run validated command |
| Git Commit | `gitCommit(sandboxId, message)` | Stage all + commit |
| Git Checkout | `gitCheckout(sandboxId, hash)` | Version rollback |
| Extend | `extendSandboxTimeout(sandboxId)` | Reset expiry timer |

## AI Generation

### Provider Integration

App Studio reuses existing AI provider keys configured in **Dashboard > Settings > AI Assistants**. No separate configuration needed.

| Provider | SDK Package | Models |
|----------|-------------|--------|
| Anthropic | `@ai-sdk/anthropic` | Claude Sonnet 4, Claude Opus 4 (supports thinking) |
| OpenAI | `@ai-sdk/openai` | GPT-4o, GPT-4o-mini |
| Google | `@ai-sdk/google` | Gemini 2.0 Flash, Gemini 2.5 Pro |
| Groq | `@ai-sdk/groq` | Llama 3.3, Mixtral |

### Streaming Pattern

```typescript
// Agent mode uses streamText with tools
const result = streamText({
  model: aiModel,
  system: systemPrompt,
  messages,
  tools: createAgentTools(containerName),
  maxSteps: 10,
  abortSignal: controller.signal,
  // Claude thinking support
  ...(enableThinking ? {
    providerOptions: {
      anthropic: { thinking: { type: "enabled", budgetTokens: 10000 } },
    },
  } : {}),
});

// Stream chunks: text, tool-call, tool-result, thinking-*, file-written, usage, done, error
```

### System Prompts

| Mode | Prompt Focus |
|------|-------------|
| Chat | Conversational help without tool calling |
| Agent | Full tool usage with project context, protected files list, guidelines for clean code |
| Plan | Generate structured implementation plan for user approval |
| Compaction | Summarize conversation history when context window fills up |

## Template System

### Built-In Templates

Templates define the initial project scaffolding:

| Template | Framework | Description |
|----------|-----------|-------------|
| React + Vite | React 18 | Default blank React app with Tailwind CSS v4 |
| (Extensible) | Various | Custom templates stored in DB |

### Template Flow

1. User selects template in Create Project dialog
2. `templateService.getTemplateFiles(templateId)` returns file list
3. Sandbox created with `createSandbox(projectId)`
4. Template files written via `initFromTemplate(sandboxId, files)`
5. `npm install` runs automatically
6. Git initial commit created

## Theme System

### Theme Structure

Themes are AI prompt instructions that guide code generation style:

```typescript
interface AppStudioTheme {
  themeId: string;
  name: string;
  description: string | null;
  prompt: string;         // Injected into system prompt
  isBuiltIn: boolean;
  userId: string | null;  // null for built-in themes
}
```

### Usage

- Themes are selected per-project
- The theme `prompt` is appended to the agent system prompt
- Users can create custom themes with natural language descriptions
- Built-in themes cannot be modified or deleted

## MCP Integration

### Overview

App Studio supports connecting external MCP (Model Context Protocol) servers that provide additional tools to the AI agent.

### Configuration

| Property | Value |
|----------|-------|
| Transport | SSE or Streamable HTTP (no stdio in SaaS) |
| Max Servers | 5 per user |
| Consent Model | Per-tool: `ask`, `always`, `denied` |
| Storage | `app_studio_mcp_server` + `app_studio_mcp_tool_consent` tables |

### Flow

1. User adds MCP server URL in Settings > MCP tab
2. System discovers available tools via `listMcpTools()`
3. User sets consent per tool (`ask`, `always`, `denied`)
4. During agent mode, approved MCP tools are merged with built-in tools
5. Tool calls go through `callMcpTool()` which proxies to the MCP server

## Version Control

### Git-Based Versioning

Each sandbox has a Git repository initialized at creation:

| Operation | Description |
|-----------|-------------|
| Auto-commit | After each agent turn that modifies files |
| Manual version | User can create labeled snapshots |
| Rollback | `gitCheckout(sandboxId, commitHash)` restores a version |
| History | `gitLog(sandboxId)` returns commit list |
| Diff | `gitDiff(sandboxId)` shows uncommitted changes |

### Version Table

```typescript
interface AppStudioVersion {
  versionId: string;
  projectId: string;
  commitHash: string;
  label: string | null;    // "AI: Updated 3 files" or user label
  createdAt: string;
}
```

## Deploy Workflow

1. User clicks "Deploy" in builder header
2. Backend validates sandbox has files
3. Creates an `application` record in existing applications table
4. `appStudioProject.applicationId` is set (FK link)
5. Sandbox files exported and copied to application
6. Production build runs (`vite build`)
7. Application deployed using existing deployment pipeline
8. User can add custom domain using existing domain management UI
9. Redeployments update the existing application

## tRPC Router Procedures

### app-studio Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `project.list` | query | List user's projects |
| `project.one` | query | Get project by ID |
| `project.create` | mutation | Create new project |
| `project.update` | mutation | Update project settings |
| `project.delete` | mutation | Delete project and sandbox |
| `project.export` | mutation | Export project as ZIP |
| `chat.list` | query | List chats for a project |
| `chat.one` | query | Get chat with messages |
| `chat.create` | mutation | Create new chat session |
| `chat.update` | mutation | Update chat title/mode |
| `chat.send` | mutation (streaming) | Send message, get AI streaming response |
| `chat.compact` | mutation | Compact conversation history |
| `message.list` | query | Get messages for a chat |
| `message.update` | mutation | Update message approval state |
| `sandbox.status` | query | Get sandbox container status |
| `sandbox.create` | mutation | Create Docker sandbox |
| `sandbox.start` | mutation | Start stopped sandbox |
| `sandbox.stop` | mutation | Stop running sandbox |
| `sandbox.destroy` | mutation | Destroy sandbox container |
| `sandbox.extend` | mutation | Extend sandbox timeout |
| `sandbox.files` | query | List files in sandbox |
| `sandbox.readFile` | query | Read file from sandbox |
| `sandbox.writeFile` | mutation | Write file to sandbox |
| `sandbox.deleteFile` | mutation | Delete file from sandbox |
| `sandbox.installPackages` | mutation | Install npm packages |
| `sandbox.restartDev` | mutation | Restart Vite dev server |
| `version.list` | query | List versions for a project |
| `version.create` | mutation | Create named version snapshot |
| `version.rollback` | mutation | Rollback to a version |
| `template.list` | query | List available templates |
| `theme.list` | query | List themes (built-in + user) |
| `theme.one` | query | Get theme by ID |
| `theme.create` | mutation | Create custom theme |
| `theme.update` | mutation | Update theme |
| `theme.delete` | mutation | Delete custom theme |
| `mcp.listServers` | query | List user's MCP servers |
| `mcp.addServer` | mutation | Add MCP server |
| `mcp.updateServer` | mutation | Update MCP server |
| `mcp.removeServer` | mutation | Remove MCP server |
| `mcp.discoverTools` | mutation | Discover tools from server |
| `mcp.setToolConsent` | mutation | Set consent for a tool |
| `deploy.create` | mutation (streaming) | Deploy project to production |
| `deploy.status` | query | Get deployment status |
| `usage.current` | query | Get current user's usage |
| `usage.limits` | query | Get plan usage limits |
| `usage.checkQuota` | query | Check if action is allowed |
| `limits.getGlobal` | query | Get global tier limits (admin) |
| `limits.setGlobal` | mutation | Set global tier limits (admin) |
| `limits.setUser` | mutation | Set per-user overrides (admin) |

## Frontend Components

### Builder Layout

Uses `ResizablePanelGroup` from Shadcn UI for the 3-panel layout:

```
+------------------+------------------+------------------+
|                  |                  |                  |
|   Chat Panel     |  Editor Panel    | Preview Panel    |
|   (25% default)  |  (40% default)   | (35% default)    |
|                  |                  |                  |
|  - Messages      |  - File tabs     | - Iframe         |
|  - Tool calls    |  - File tree     | - Responsive     |
|  - Input + mode  |  - Code viewer   |   mode toggle    |
|  - Model select  |  - Console panel | - Status badge   |
|  - Think budget  |  - Search        | - Refresh        |
+------------------+------------------+------------------+
```

### Component Hierarchy

```
AppStudioBuilderPage
├── BuilderHeader (project name, deploy, export, settings)
├── BuilderLayout (ResizablePanelGroup)
│   ├── ChatPanel
│   │   ├── MessageList
│   │   │   ├── ChatMessage (user/assistant bubbles)
│   │   │   └── ToolCallDisplay (tool invocation rendering)
│   │   ├── ChatInput
│   │   │   ├── ModeSelector (chat/agent/plan)
│   │   │   └── ThinkingBudget (token slider for Claude)
│   │   └── ModelSelector
│   ├── EditorPanel
│   │   ├── FileTabs (open file tabs)
│   │   ├── FileTree (sidebar)
│   │   ├── CodeViewer (syntax highlighted, read-only)
│   │   ├── ConsolePanel (command output)
│   │   ├── SearchDialog (Cmd+P file search)
│   │   └── TextSearch (Cmd+F in-file search)
│   └── PreviewPanel
│       ├── PreviewToolbar (responsive modes, refresh)
│       ├── PreviewIframe (sandbox URL)
│       └── SandboxStatus (creating/running/expired)
├── ActionSidebar (quick actions)
├── VersionList (version history panel)
├── DeployDialog
└── ExportButton
```

### Project List Page

Uses **table view** (NOT card grid) for design differentiation from main app:

| Column | Content |
|--------|---------|
| Name | Project name with favorite star |
| Template | Template framework badge |
| Status | Draft / Building / Ready / Deployed / Error badge |
| Created | Relative time |
| Actions | Open, Settings, Deploy, Delete (inline buttons) |

## Usage Tracking

### Tracked Metrics

| Metric | Description | Limit Type |
|--------|-------------|------------|
| `messageCount` | Total AI messages sent | Per period |
| `tokensUsed` | Total tokens consumed | Per period |
| `projectsCreated` | Projects created | Per period |
| `sandboxMinutes` | Total sandbox runtime | Per period |
| `agentToolCalls` | Agent tool invocations | Per period |

### Tier Limits

| Tier | Messages | Tokens | Projects | Sandbox Min | Tool Calls | Reset |
|------|----------|--------|----------|-------------|------------|-------|
| Free | 50 | 100K | 3 | 60 | 100 | 30 days |
| Premium | 500 | 1M | 20 | 600 | 1000 | 30 days |
| Enterprise | -1 | -1 | -1 | -1 | -1 | 30 days |

(-1 = unlimited)

### Recording Pattern

```typescript
// After each AI response (in agent-handler.ts)
await trackUsage(userId, {
  promptTokens: executionLog.tokensInput,
  completionTokens: executionLog.tokensOutput,
}, toolCallCount);
```

## Database Schema

### Tables (11 total)

| Table | Purpose |
|-------|---------|
| `app_studio_project` | Projects (name, status, template, theme, userId, applicationId FK) |
| `app_studio_chat` | Chat sessions (projectId, mode, compaction state) |
| `app_studio_message` | Messages (chatId, role, content, tokens, approval state, commit hash) |
| `app_studio_version` | Version snapshots (projectId, commitHash, label) |
| `app_studio_theme` | Themes (name, prompt, isBuiltIn, userId) |
| `app_studio_sandbox` | Sandboxes (projectId, containerId, port, status, expiresAt) |
| `app_studio_usage` | Per-user usage (messageCount, tokensUsed, toolCalls, etc.) |
| `app_studio_limits_config` | Per-tier limits (maxMessages, maxTokens, etc.) |
| `app_studio_user_limits` | Per-user limit overrides |
| `app_studio_mcp_server` | MCP server configs (name, transport, url, enabled) |
| `app_studio_mcp_tool_consent` | Per-tool consent (serverId, toolName, consent) |

### Relations

```
appStudioProject → appStudioChat (1:many)
appStudioProject → appStudioVersion (1:many)
appStudioProject → appStudioSandbox (1:1)
appStudioProject → appStudioTheme (many:1 via themeId)
appStudioProject → application (1:1 via applicationId FK)
appStudioChat → appStudioMessage (1:many)
appStudioMcpServer → appStudioMcpToolConsent (1:many)
appStudioUsage → user (1:1)
appStudioUserLimits → user (1:1)
```

## React Query Keys

```typescript
export const appStudioKeys = {
  all: ['app-studio'] as const,
  projects: {
    all: () => [...appStudioKeys.all, 'projects'] as const,
    lists: () => [...appStudioKeys.projects.all(), 'list'] as const,
    detail: (id: string) => [...appStudioKeys.projects.all(), 'detail', id] as const,
  },
  chats: {
    all: () => [...appStudioKeys.all, 'chats'] as const,
    byProject: (projectId: string) => [...appStudioKeys.chats.all(), 'project', projectId] as const,
    detail: (id: string) => [...appStudioKeys.chats.all(), 'detail', id] as const,
    messages: (id: string) => [...appStudioKeys.chats.detail(id), 'messages'] as const,
  },
  versions: {
    byProject: (projectId: string) => [...appStudioKeys.all, 'versions', 'project', projectId] as const,
  },
  themes: {
    lists: () => [...appStudioKeys.all, 'themes', 'list'] as const,
    detail: (id: string) => [...appStudioKeys.all, 'themes', 'detail', id] as const,
  },
  sandboxes: {
    status: (id: string) => [...appStudioKeys.all, 'sandboxes', 'status', id] as const,
    files: (id: string) => [...appStudioKeys.all, 'sandboxes', 'files', id] as const,
  },
  templates: {
    lists: () => [...appStudioKeys.all, 'templates', 'list'] as const,
  },
  usage: {
    current: () => [...appStudioKeys.all, 'usage', 'current'] as const,
    limits: () => [...appStudioKeys.all, 'usage', 'limits'] as const,
    quota: (action: string) => [...appStudioKeys.all, 'usage', 'quota', action] as const,
  },
  deploy: {
    status: (projectId: string) => [...appStudioKeys.all, 'deploy', 'status', projectId] as const,
  },
  limits: {
    global: () => [...appStudioKeys.all, 'limits', 'global'] as const,
    userOverrides: (userId: string) => [...appStudioKeys.all, 'limits', 'user', userId] as const,
  },
};

// CORRECT - use factory
useQuery({ queryKey: appStudioKeys.projects.detail(id) });

// WRONG - ad-hoc keys
useQuery({ queryKey: ['app-studio', 'project', id] });
```

## Service Layer Pattern

```typescript
// client/src/services/app-studio/appStudioService.ts
import { trpcQuery, trpcMutation } from '@/lib/api/dokploy';

export const AppStudioService = {
  async listProjects(): Promise<AppStudioProject[]> {
    return trpcQuery<AppStudioProject[]>('appStudio', 'project.list');
  },
  async getProject(id: string): Promise<AppStudioProject> {
    return trpcQuery<AppStudioProject>('appStudio', 'project.one', { projectId: id });
  },
  async createProject(data: CreateProjectInput): Promise<AppStudioProject> {
    return trpcMutation<AppStudioProject>('appStudio', 'project.create', data);
  },
  async deleteProject(id: string): Promise<void> {
    return trpcMutation<void>('appStudio', 'project.delete', { projectId: id });
  },
  async getSandboxStatus(sandboxId: string): Promise<AppStudioSandbox> {
    return trpcQuery<AppStudioSandbox>('appStudio', 'sandbox.status', { sandboxId });
  },
  async createSandbox(projectId: string): Promise<AppStudioSandbox> {
    return trpcMutation<AppStudioSandbox>('appStudio', 'sandbox.create', { projectId });
  },
};
```

## Feature Flag

App Studio is gated behind a feature flag:

```typescript
// serverlessbase/packages/server/src/constants/platform-features.ts
{
  name: "app_studio",
  description: "App Studio AI App Builder",
  category: "ai",
  defaultEnabled: true,
}

// Frontend route gating (beforeLoad redirect)
// Component gating via useFeatureFlags()
// Backend gating via assertFeatureEnabled()
```

## RTL/i18n Requirements

### Translations

All strings MUST be translated in 5 languages:

| Language | File |
|----------|------|
| English | `client/public/locales/en/appStudio.json` |
| Arabic | `client/public/locales/ar/appStudio.json` |
| French | `client/public/locales/fr/appStudio.json` |
| German | `client/public/locales/de/appStudio.json` |
| Spanish | `client/public/locales/es/appStudio.json` |

### RTL Patterns

```typescript
// CORRECT - logical properties
<div className="ms-4 me-2 ps-3 pe-3 text-start">
<ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />

// WRONG - physical properties
<div className="ml-4 mr-2 pl-3 pr-3 text-left">
```

## Troubleshooting Guide

### Sandbox Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Sandbox not starting | Port conflict | Check `docker ps` for port range 50000-50999 |
| Preview not loading | Vite not started | Check sandbox logs with `docker logs` |
| Files not updating | Container paused | Extend timeout, check container status |
| Sandbox expired | Inactivity timeout | Create new sandbox (files preserved in git) |
| Creation timeout | Slow image pull | Pre-pull `node:22-slim` image |

### AI Generation Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| No response | Missing API key | Check AI provider settings |
| Tool calls fail | Sandbox not running | Ensure sandbox is in "running" state |
| Model doesn't support tools | Wrong model for agent mode | Select a model with `supportsTools: true` |
| Thinking not working | Non-Claude model | Thinking only available for Claude models |
| Context too long | Many messages | Compact conversation via `chat.compact` |

### MCP Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Server unreachable | Wrong URL | Verify server URL is accessible |
| Tools not showing | Discovery failed | Re-run `mcp.discoverTools` |
| Tool denied | Consent not set | Set consent to `always` in MCP settings |

### Fire & Forget Execution Issues

#### Polling Wastes Resources When Tab Is Inactive

**Symptoms**: High server load from polling requests even when users aren't looking at the page.

**Cause**: Fixed-interval polling continues when the browser tab is hidden.

**Fix**: Use adaptive polling with visibility-based pause:
- **Adaptive intervals**: 3s (active) → 10s (30s idle) → 30s (2min+ idle)
- **Pause when hidden**: Stop polling when `document.hidden` is true
- **Resume on focus**: Restart polling immediately when tab regains focus with `refetchOnWindowFocus`

```typescript
// Anti-pattern: fixed interval, wastes resources
setInterval(() => fetchStatus(), 5000);

// Correct: adaptive + visibility-aware
useQuery({
  queryKey: fireForgetKeys.execution.status(executionId),
  queryFn: () => FireForgetService.getStatus(executionId),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    if (["completed", "cancelled"].includes(status)) return false;
    return getAdaptiveInterval(lastActivityRef.current);
  },
});
```

#### Auto-Retry Only Triggers on "Failed" (Misses "Paused")

**Symptoms**: Executions stuck in "paused" status are never retried automatically.

**Cause**: Auto-retry logic only checks for `status === 'failed'`.

**Fix**: Auto-retry MUST trigger on BOTH `failed` AND `paused` statuses:
```typescript
// Anti-pattern: only retries failed
if (status === 'failed' && autoRetryEnabled) { retry(); }

// Correct: retries both failed and paused
if (['failed', 'paused'].includes(status) && autoRetryEnabled) { retry(); }
```

#### Auto-Retry Configuration

| Property | Values |
|----------|--------|
| Trigger statuses | `failed`, `paused` |
| Delay options | 5s, 10s, 30s, 60s (user-configurable) |
| Default delay | 10 seconds |
| Max retries | Configurable per execution (default: 3) |
| Backoff | None (fixed delay, user-selected) |

**UI Requirements**:
- Toggle switch to enable/disable auto-retry
- Countdown timer showing seconds until next retry (for both failed and paused)
- Retry count display: "Retry 2/3"
- Stop button to cancel pending retry

## Ralph Wiggum Iteration Mode

App Studio supports an optional iteration mode powered by Ralph Wiggum AI loops. When enabled, the agent handler wraps `handleAgentStep()` in an iteration loop that feeds previous output back into the prompt until a completion promise is detected and verification passes.

### Hat Presets

| Preset | Rotation | Hats | Max Iterations |
|--------|----------|------|---------------|
| build | Sequential (cycles) | Planner → Builder → Tester → Reviewer | 15 |
| fix | Single | Debugger | 10 |
| refactor | Single | Refactorer | 10 |

### Shared Services from Fire-and-Forget

App Studio reuses these shared services (does NOT duplicate them):
- `completion-promise-service.ts` — Detects success conditions in AI output
- `verification-gate-service.ts` — Runs typecheck, lint, test between iterations
- `git-checkpoint-service.ts` — Periodic commits for rollback

### Sandbox Behavior in Iteration Mode

| Property | Default | Iteration Mode |
|----------|---------|---------------|
| Timeout | 15 minutes | 4 hours |
| State persistence | None | currentIteration, activeHatId, lastCheckpointHash |
| Checkpoint | None | Every 3 iterations (configurable) |

### Frontend Controls

- **Iteration toggle**: Enable/disable in action rail
- **Progress bar**: Shows "Iteration 3 / 10 - Builder" with hat emoji
- **Controls**: Pause (after current iteration), Resume, Cancel
- **Cost display**: Current iteration cost, total loop cost, estimated remaining
- **Chat markers**: Horizontal separator between iterations with hat badge

### PAYG Billing

Each iteration logged separately with:
- `source: "app_studio"`
- `iterationNumber: N`
- `hatId: "builder"`
- `modelId: "claude-3-sonnet"` (or whatever model was routed)

### Configuration

Gated behind superadmin config:
- `appstudio.ralph.enabled` — Master toggle
- `appstudio.ralph.maxIterations` — Max iterations per session
- `appstudio.ralph.defaultPreset` — Default preset (build/fix/refactor)
- `appstudio.ralph.allowUserOverride` — Allow users to change settings

See `.claude/rules/ralph-wiggum-integration.md` for shared iteration loop patterns.

## Validation Checklist

Before completing App Studio features:

- [ ] Docker-only execution (no host commands)
- [ ] Container naming uses `serverless-appstudio-sandbox-*`
- [ ] Port allocation within 50000-50999 range
- [ ] AI provider keys reused from existing settings
- [ ] Streaming via tRPC (not WebSocket or polling)
- [ ] Agent tools have safety checks (blocklist, timeout, protected files)
- [ ] Agent context building (file tree, diff, package info)
- [ ] Max steps and total timeout enforced
- [ ] Auto-commit after file modifications
- [ ] Version snapshots created automatically
- [ ] Table view for project list (not card grid)
- [ ] Inline action buttons (not dropdown menus)
- [ ] RTL support with logical CSS properties
- [ ] All strings in 5 languages (appStudio.json namespace)
- [ ] Dark mode with semantic color tokens
- [ ] Touch targets minimum 44x44px
- [ ] React Query key factory used (appStudioKeys)
- [ ] Service layer pattern followed
- [ ] Feature flag gating implemented (`app_studio`)
- [ ] MCP servers limited to HTTP transports (no stdio)
- [ ] MCP tool consent model enforced
- [ ] Usage tracking after each AI response
- [ ] Quota checks before expensive operations
- [ ] No references to E2B or Vercel sandbox
- [ ] No `dokploy-*` naming
- [ ] Ralph iteration mode gated behind superadmin config
- [ ] Hat presets load correctly (build/fix/refactor)
- [ ] Sandbox timeout extends to 4 hours in iteration mode
- [ ] Iteration events stream to frontend via tRPC
- [ ] PAYG logs per-iteration with source: "app_studio"
- [ ] Pause/Resume/Cancel controls work correctly
- [ ] Shared services imported from fire-forget (not duplicated)

## File Location Reference

| Layer | Location | Purpose |
|-------|----------|---------|
| Schema | `serverlessbase/packages/server/src/db/schema/app-studio.ts` | 11 database tables |
| Services | `serverlessbase/packages/server/src/services/app-studio/` | 20+ backend service files |
| Prompts | `serverlessbase/packages/server/src/services/app-studio/prompts/` | AI system prompts |
| Router | `serverlessbase/apps/serverlessbase/server/api/routers/app-studio.ts` | tRPC procedures |
| Types | `client/src/types/app-studio.ts` | Frontend TypeScript types |
| Services | `client/src/services/app-studio/` | API call wrappers |
| Hooks | `client/src/hooks/app-studio/` | React Query hooks |
| Query Keys | `client/src/hooks/app-studio/queryKeys.ts` | Cache key factory |
| Components | `client/src/components/dashboard/app-studio/` | UI components |
| Builder | `client/src/components/dashboard/app-studio/builder/` | Builder panel components |
| Themes | `client/src/components/dashboard/app-studio/themes/` | Theme management UI |
| Settings | `client/src/components/dashboard/app-studio/settings/` | Project settings tabs |
| Deploy | `client/src/components/dashboard/app-studio/deploy/` | Deploy/export UI |
| Billing | `client/src/components/dashboard/app-studio/billing/` | Usage/upgrade UI |
| Tests | `client/src/components/dashboard/app-studio/__tests__/` | Component tests |
| Backend Tests | `serverlessbase/packages/server/src/services/app-studio/__tests__/` | Service tests |
| E2E Tests | `client/tests/e2e/app-studio/` | End-to-end tests |
| Routes | `client/src/routes/_app/_auth/dashboard/_layout.app-studio*` | Page routes |
| Superadmin | `client/src/routes/_app/_superadmin/superadmin/_layout.app-studio.tsx` | Admin page |
| Translations | `client/public/locales/{lang}/appStudio.json` | i18n strings |
| Feature Flag | `serverlessbase/packages/server/src/constants/platform-features.ts` | `app_studio` flag |
| Skill | `.claude/skills/app-studio/SKILL.md` | This file |
| Rules | `.claude/rules/app-studio-patterns.md` | Development rules |

## References

- Agent Mode Patterns: `references/agent-mode-patterns.md`
- Sandbox Lifecycle: `references/sandbox-lifecycle.md`
- Streaming Patterns: `references/streaming-patterns.md`
- Builder UI Patterns: `references/builder-ui-patterns.md`
