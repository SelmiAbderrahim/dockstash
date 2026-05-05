# Agent Mode Patterns - App Studio Reference

## Overview

Agent Mode is the primary operating mode for App Studio. The AI has access to 7 tools that operate on a Docker sandbox container via `docker exec`. Each agent message can invoke multiple tool call rounds (up to `maxSteps`), and the entire execution is bounded by a 5-minute timeout.

## Agent Execution Flow

```
User Message
     ↓
1. Verify chat/project/sandbox access
2. Build rich context (file tree, git diff, package info)
3. Resolve AI provider and model
4. Build system prompt with context + protected files + theme
5. Build message history (with compaction support)
6. Save user message to DB
     ↓
Stream AI Response (with tools)
     ↓
For each stream part:
  - text-delta      → yield text chunk
  - reasoning       → yield thinking-start/content/end
  - tool-call       → yield tool invocation info
  - tool-result     → yield result, track file changes
     ↓
After streaming completes:
7. Save assistant message to DB
8. Track usage (tokens + tool calls)
9. Auto-commit if files were modified
10. Create version snapshot
11. Yield usage + done chunks
```

## Tool Definitions

### read_file

Reads file contents from the sandbox. Always use before editing.

```typescript
tool({
  description: "Read the contents of a file in the project.",
  parameters: z.object({
    path: z.string().describe("Relative file path from project root"),
  }),
  execute: async ({ path }) => {
    const resolvedPath = validateSandboxPath(path);
    const { stdout } = await execInSandboxWithTimeout(containerName, `cat '${resolvedPath}'`, 10000);
    return { success: true, content: truncateOutput(stdout) };
  },
});
```

### write_file

Creates or replaces a file. Content is base64-encoded for safe transfer.

```typescript
tool({
  description: "Write content to a file. Creates parent directories automatically.",
  parameters: z.object({
    path: z.string(),
    content: z.string().describe("The complete file content to write"),
  }),
  execute: async ({ path, content }) => {
    // Protected file check
    if (PROTECTED_FILES.has(normalizePath(path))) {
      return { success: false, error: `Cannot modify protected file` };
    }
    // mkdir -p + base64 decode write
    const encoded = Buffer.from(content, "utf-8").toString("base64");
    await execInSandboxWithTimeout(containerName, `echo '${encoded}' | base64 -d > '${resolvedPath}'`, 10000);
    return { success: true, path: normalized };
  },
});
```

### edit_file

Targeted find-and-replace. Avoids rewriting entire files.

```typescript
tool({
  description: "Edit a file by replacing a specific string with new content.",
  parameters: z.object({
    path: z.string(),
    oldText: z.string().describe("Exact text to find and replace"),
    newText: z.string().describe("Text to replace with"),
  }),
  execute: async ({ path, oldText, newText }) => {
    // Read current → verify oldText exists → replace → write back
    const currentContent = await readFromContainer(containerName, path);
    if (!currentContent.includes(oldText)) {
      return { success: false, error: "Could not find the specified text" };
    }
    const newContent = currentContent.replace(oldText, newText);
    await writeToContainer(containerName, path, newContent);
    return { success: true, path };
  },
});
```

### delete_file

Removes a file (cannot delete protected files).

### run_shell

Executes shell commands with a 30-second timeout and blocklist enforcement.

```typescript
// Blocked patterns include:
// rm -rf /, shutdown, reboot, curl|bash, fork bombs, dd of=/dev
const BLOCKED_COMMAND_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\/(?:\s|$)/,
  /shutdown/, /reboot/, /halt/,
  /curl\s+.*\|\s*sh/, /wget\s+.*\|\s*bash/,
  // ... more patterns
];
```

### search_code

Grep across project files, excluding `node_modules` and `.git`.

### list_files

List directory contents, optionally recursive (up to 4 levels, max 200 files).

## Context Building

Before each agent message, `buildAgentContext()` runs concurrently:

```typescript
interface AgentContext {
  fileTree: string[];        // Recursive file listing
  recentChanges: string;     // git diff output
  packageInfo: {             // Parsed package.json
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  } | null;
}
```

This context is formatted and injected into the system prompt:

```
## Current Project Context

### File Tree
src/App.tsx
src/main.tsx
src/index.css
...

### Recent Changes
diff --git a/src/App.tsx b/src/App.tsx
...

### Dependencies
react: ^18.3.1
react-dom: ^18.3.1
tailwindcss: ^4.0.0
...
```

## Protected Files

These files cannot be modified or deleted by agent tools:

| File | Reason |
|------|--------|
| `vite.config.ts` / `vite.config.js` | Dev server configuration |
| `tailwind.config.js` / `tailwind.config.ts` | Tailwind setup |
| `tsconfig.json` | TypeScript configuration |
| `postcss.config.js` / `postcss.config.cjs` | PostCSS setup |
| `package.json` | Dependencies (use `run_shell npm install` instead) |
| `package-lock.json` | Lock file |
| `index.html` | Entry HTML |

## Multi-Step Workflow

The agent can make up to `maxSteps` (default 10) tool call rounds per message:

```
Step 1: AI calls list_files to understand project structure
Step 2: AI calls read_file on relevant files
Step 3: AI calls write_file to create new component
Step 4: AI calls edit_file to update imports in App.tsx
Step 5: AI calls run_shell to install a new package
Step 6: AI provides final text explanation
```

Each step can invoke multiple tools. The Vercel AI SDK handles the tool result → next AI response loop automatically.

## Timeout and Cancellation

```typescript
// Total execution timeout: 5 minutes
const TOTAL_EXECUTION_TIMEOUT_MS = 5 * 60 * 1000;

// Creates a combined AbortController for:
// 1. User cancellation (via frontend abort)
// 2. Total timeout
function createTimeoutController(userSignal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOTAL_EXECUTION_TIMEOUT_MS);
  // Forward user abort signal
  if (userSignal) userSignal.addEventListener("abort", () => controller.abort());
  return { controller, cleanup: () => clearTimeout(timer) };
}
```

## Execution Logging

Every agent execution is tracked:

```typescript
interface AgentExecutionLog {
  startedAt: number;
  completedAt?: number;
  toolCalls: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
    durationMs: number;
    success: boolean;
  }>;
  filesWritten: string[];
  filesEdited: string[];
  tokensInput: number;
  tokensOutput: number;
  error?: string;
}
```

## Auto-Versioning

After each agent turn that modifies files:

1. Agent tracks `filesModified` array during execution
2. If `filesModified.length > 0`, auto-creates a git commit
3. Creates a version record in `app_studio_version` table
4. Label: `"AI: Updated {filename}"` or `"AI: Updated N files"`
5. Yields `commitHash` and `versionCreated` in the `done` chunk

## Claude Thinking Support

For Claude models with `supportsThinking`, extended thinking is enabled:

```typescript
const enableThinking = isClaudeModel && (modelDef?.supportsThinking ?? false);

streamText({
  model: aiModel,
  ...(enableThinking ? {
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 10000 },
      },
    },
  } : {}),
});
```

Thinking chunks are streamed as:
- `thinking-start` → start of reasoning block
- `thinking-content` → reasoning text delta
- `thinking-end` → end with `thinkingDurationMs`
