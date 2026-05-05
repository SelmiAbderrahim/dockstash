# Builder UI Patterns - App Studio Reference

## Overview

The App Studio builder is a 3-panel layout using Shadcn UI's `ResizablePanelGroup`. Each panel serves a distinct purpose: chat for AI interaction, editor for code viewing, and preview for live rendering.

## Panel Layout

```
+------------------+------------------+------------------+
|                  |                  |                  |
|   Chat Panel     |  Editor Panel    | Preview Panel    |
|   (25% default)  |  (40% default)   | (35% default)    |
|   min: 15%       |  min: 20%        | min: 20%         |
|                  |                  |                  |
+------------------+------------------+------------------+
```

### ResizablePanelGroup

```tsx
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={25} minSize={15}>
    <ChatPanel />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={40} minSize={20}>
    <EditorPanel />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={35} minSize={20}>
    <PreviewPanel />
  </ResizablePanel>
</ResizablePanelGroup>
```

## Chat Panel

### Message Types

| Type | Rendering |
|------|-----------|
| User message | Right-aligned bubble with user text |
| AI text | Left-aligned bubble with markdown rendering |
| Tool call | Collapsible block showing tool name + arguments |
| Tool result | Nested under tool call with success/error status |
| Thinking | Collapsible "thinking" block (Claude only) |
| File written | Inline notification "Updated src/App.tsx" |
| Error | Red error banner |

### Tool Call Display

```tsx
// ToolCallDisplay renders agent tool invocations
<div className="border rounded-md p-2 bg-muted/50">
  <div className="flex items-center gap-2">
    <ToolIcon name={toolName} />
    <span className="font-mono text-sm">{toolName}</span>
    <Badge variant={success ? "default" : "destructive"}>
      {success ? "Done" : "Failed"}
    </Badge>
  </div>
  <Collapsible>
    <CollapsibleContent>
      <pre className="text-xs mt-2">{JSON.stringify(args, null, 2)}</pre>
      {result && <pre className="text-xs mt-1 text-muted-foreground">{JSON.stringify(result)}</pre>}
    </CollapsibleContent>
  </Collapsible>
</div>
```

### Chat Input

Features:
- Text input with Enter to send, Shift+Enter for newline
- Mode selector (chat / agent / plan)
- Model selector dropdown
- Thinking budget slider (for Claude models)
- Send button with loading spinner

```tsx
<div className="flex flex-col gap-2 p-3 border-t">
  <div className="flex items-center gap-2">
    <ModeSelector value={mode} onChange={setMode} />
    <ModelSelector value={model} onChange={setModel} />
    {showThinkingBudget && <ThinkingBudget value={budget} onChange={setBudget} />}
  </div>
  <div className="flex items-center gap-2">
    <Textarea
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={t("appStudio.chat.placeholder")}
      className="flex-1 min-h-[44px] max-h-[200px]"
    />
    <Button onClick={handleSend} disabled={isSending} className="h-[44px] min-w-[44px]">
      {isSending ? <Loader2 className="animate-spin" /> : <Send />}
    </Button>
  </div>
</div>
```

## Editor Panel

### Layout

```
+------------------------------------------+
|  [File Tabs: App.tsx | main.tsx | ...]   |
+----------+-------------------------------+
|          |                               |
|  File    |     Code Viewer               |
|  Tree    |     (syntax highlighted)      |
|  (side)  |     (read-only)               |
|          |                               |
+----------+-------------------------------+
|  Console Panel (collapsible)             |
|  [stdout/stderr from shell commands]     |
+------------------------------------------+
```

### File Tree

- Collapsible sidebar showing sandbox directory structure
- Excludes `node_modules` and `.git`
- Click file to open in code viewer
- Icons based on file extension
- Right-click context not needed (AI handles modifications)

### File Tabs

- Open files shown as tabs above code viewer
- Active tab highlighted
- Close button on each tab
- Overflow scrollable

### Code Viewer

- Syntax highlighted (read-only)
- Based on file extension (.tsx, .ts, .css, .json, etc.)
- Line numbers
- Updates automatically when agent writes files

### Console Panel

- Collapsible at bottom of editor panel
- Shows output from `run_shell` tool calls
- Scrollable with auto-scroll
- Clear button

### Search

- `Cmd+P` / `Ctrl+P`: File search dialog (fuzzy matching)
- `Cmd+F` / `Ctrl+F`: In-file text search

## Preview Panel

### Layout

```
+------------------------------------------+
|  [Desktop] [Tablet] [Mobile] [Refresh]   |
|  [Sandbox Status: Running ●]             |
+------------------------------------------+
|                                          |
|            Iframe                        |
|   (http://localhost:{port})              |
|                                          |
|                                          |
+------------------------------------------+
```

### Responsive Modes

| Mode | Width | Icon |
|------|-------|------|
| Desktop | 100% | `Monitor` |
| Tablet | 768px | `Tablet` |
| Mobile | 375px | `Smartphone` |

### Sandbox Status

| Status | Indicator | Description |
|--------|-----------|-------------|
| Creating | Yellow spinner | Container starting up |
| Running | Green dot | Active and serving |
| Idle | Gray dot | Stopped, can be restarted |
| Expired | Red dot | Needs new sandbox |
| Destroyed | No indicator | Sandbox removed |

### Iframe Rendering

```tsx
<iframe
  src={`http://localhost:${sandbox.port}`}
  className={cn(
    "border-0 bg-white",
    responsiveMode === "desktop" && "w-full h-full",
    responsiveMode === "tablet" && "w-[768px] h-full mx-auto",
    responsiveMode === "mobile" && "w-[375px] h-full mx-auto",
  )}
  title="App Studio Preview"
  sandbox="allow-scripts allow-same-origin allow-forms"
/>
```

## Builder Header

```
+------------------------------------------------------------------+
|  ← Back  |  Project Name  |  ★  |  [Deploy] [Export] [Settings] |
+------------------------------------------------------------------+
```

Features:
- Back navigation to project list
- Editable project name
- Favorite toggle
- Deploy button (opens deploy dialog)
- Export button (downloads ZIP)
- Settings button (opens project settings)

## Action Sidebar

Quick actions accessible from the builder:

| Action | Shortcut | Description |
|--------|----------|-------------|
| New Chat | `Cmd+N` | Start new chat session |
| Search | `Cmd+P` | Search files |
| Find | `Cmd+F` | Find in file |
| Version History | `Cmd+H` | Show version list |
| Deploy | `Cmd+D` | Open deploy dialog |
| Settings | `Cmd+,` | Open settings |

## Version List

Collapsible panel showing git history:

```tsx
<div className="space-y-2">
  {versions.map((version) => (
    <div key={version.versionId} className="flex items-center justify-between p-2 rounded border">
      <div>
        <p className="text-sm font-medium">{version.label || version.commitHash.slice(0, 7)}</p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(version.createdAt)}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => rollback(version.commitHash)}>
        Restore
      </Button>
    </div>
  ))}
</div>
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Send message |
| `Cmd+P` | File search |
| `Cmd+F` | Text search |
| `Cmd+N` | New chat |
| `Cmd+H` | Version history |
| `Cmd+D` | Deploy |
| `Cmd+,` | Settings |
| `Escape` | Close dialog/search |

## RTL Considerations

- Chat messages: user on end side, AI on start side
- File tree: expands in correct direction
- Tab bar: scrolls in correct direction
- All margins/padding use logical properties (`ms-`, `me-`, `ps-`, `pe-`)
- Directional icons use `rtl:scale-x-[-1]`

## Mobile Responsiveness

On smaller screens, panels collapse to tabs:
- Default: only preview panel visible
- Swipe/tap to switch between chat, editor, preview
- Touch targets minimum 44x44px throughout
