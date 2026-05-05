# Builder UI Patterns - WebSmith Reference

## Overview

The WebSmith builder uses a 3-panel layout built with Shadcn UI's `ResizablePanelGroup` component. The layout consists of a chat panel, code editor panel, and live preview panel.

## Layout Structure

### 3-Panel Builder

```
+------------------+------------------+------------------+
|                  |                  |                  |
|   Chat Panel     |  Editor Panel    | Preview Panel    |
|   (25% default)  |  (35% default)   | (40% default)    |
|   min: 15%       |  min: 20%        | min: 20%         |
|                  |                  |                  |
|  +-----------+   |  +-----------+  | +--------------+  |
|  |  Messages |   |  | File Tree |  | | Preview Bar  |  |
|  |  (scroll) |   |  | (sidebar) |  | | [D] [T] [M]  |  |
|  |           |   |  |           |  | +--------------+  |
|  |           |   |  | Code View |  | |              |  |
|  |           |   |  | (main)    |  | |   Iframe     |  |
|  |           |   |  |           |  | |   (sandbox)  |  |
|  +-----------+   |  +-----------+  | |              |  |
|  | Input     |   |                 | |              |  |
|  | [Model v] |   |                 | +--------------+  |
|  +-----------+   |                 | | Status: OK   |  |
|                  |                 | +--------------+  |
+------------------+------------------+------------------+
```

### Implementation

```typescript
// client/src/components/dashboard/websmith/builder-layout.tsx
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

interface BuilderLayoutProps {
  projectId: string;
  sessionId: string;
  sandboxId: string;
  sandboxUrl: string;
}

export function BuilderLayout({
  projectId,
  sessionId,
  sandboxId,
  sandboxUrl,
}: BuilderLayoutProps) {
  return (
    <div className="h-[calc(100vh-64px)]">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={25} minSize={15} className="flex flex-col">
          <ChatPanel sessionId={sessionId} sandboxId={sandboxId} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor Panel */}
        <ResizablePanel defaultSize={35} minSize={20} className="flex flex-col">
          <EditorPanel sandboxId={sandboxId} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Preview Panel */}
        <ResizablePanel defaultSize={40} minSize={20} className="flex flex-col">
          <PreviewPanel sandboxUrl={sandboxUrl} sandboxId={sandboxId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
```

## Chat Panel

### Message Types

```typescript
type MessageRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  fileChanges?: FileChange[];  // Files modified by AI in this message
  isStreaming?: boolean;        // Currently being streamed
}
```

### Message List Component

```typescript
// client/src/components/dashboard/websmith/chat-panel.tsx
export function ChatPanel({ sessionId, sandboxId }: ChatPanelProps) {
  const { messages, sendMessage, isStreaming, streamingContent } = useWebsmithChat(sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-medium">{t('websmith.chat.title')}</h3>
        <ModelSelector />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <MessageBubble
            message={{ role: 'assistant', content: streamingContent, isStreaming: true }}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
```

### Message Bubble Styling

```typescript
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      'flex gap-3',
      isUser ? 'justify-end' : 'justify-start',
    )}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn(
        'max-w-[85%] rounded-lg px-3 py-2 text-sm',
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-foreground',
      )}>
        {message.isStreaming ? (
          <StreamingText content={message.content} />
        ) : (
          <MarkdownContent content={message.content} />
        )}
        {message.fileChanges && message.fileChanges.length > 0 && (
          <FileChangeIndicator changes={message.fileChanges} />
        )}
      </div>
    </div>
  );
}
```

### File Change Indicator

```typescript
function FileChangeIndicator({ changes }: { changes: FileChange[] }) {
  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <span className="text-xs text-muted-foreground">
        {t('websmith.chat.filesChanged', { count: changes.length })}
      </span>
      <div className="mt-1 space-y-1">
        {changes.map((change) => (
          <div key={change.path} className="flex items-center gap-1 text-xs">
            <FileCode className="h-3 w-3" />
            <span className="font-mono">{change.path.split('/').pop()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Editor Panel

### File Tree

```typescript
// client/src/components/dashboard/websmith/editor-panel.tsx

interface FileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

export function EditorPanel({ sandboxId }: { sandboxId: string }) {
  const { data: files } = useSandboxFiles(sandboxId);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { data: fileContent } = useSandboxFileContent(sandboxId, selectedFile);

  return (
    <div className="flex h-full">
      {/* File Tree Sidebar */}
      <div className="w-48 border-e border-border overflow-y-auto">
        <div className="p-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
            {t('websmith.editor.files')}
          </h4>
          <FileTree
            files={files || []}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
          />
        </div>
      </div>

      {/* Code Viewer */}
      <div className="flex-1 overflow-hidden">
        {selectedFile ? (
          <CodeViewer
            filename={selectedFile}
            content={fileContent || ''}
            language={getLanguageFromFilename(selectedFile)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {t('websmith.editor.selectFile')}
          </div>
        )}
      </div>
    </div>
  );
}
```

### File Tree Rendering

```typescript
function FileTree({ files, selectedFile, onSelect }: FileTreeProps) {
  return (
    <ul className="space-y-0.5">
      {files.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          selectedFile={selectedFile}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </ul>
  );
}

function FileTreeItem({ entry, selectedFile, onSelect, depth }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const isSelected = selectedFile === entry.path;

  if (entry.type === 'directory') {
    return (
      <li>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center gap-1 w-full px-2 py-1 text-xs rounded hover:bg-muted/50',
            'min-h-[32px]',
          )}
          style={{ paddingInlineStart: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 rtl:scale-x-[-1]" />
          )}
          <Folder className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{entry.name}</span>
        </button>
        {isExpanded && entry.children && (
          <ul>
            {entry.children.map((child) => (
              <FileTreeItem
                key={child.path}
                entry={child}
                selectedFile={selectedFile}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={() => onSelect(entry.path)}
        className={cn(
          'flex items-center gap-1 w-full px-2 py-1 text-xs rounded',
          'min-h-[32px]',
          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
        )}
        style={{ paddingInlineStart: `${depth * 12 + 8}px` }}
      >
        <FileCode className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </button>
    </li>
  );
}
```

## Preview Panel

### Implementation

```typescript
// client/src/components/dashboard/websmith/preview-panel.tsx

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_SIZES: Record<ViewportMode, { width: string; label: string }> = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '375px', label: 'Mobile' },
};

export function PreviewPanel({ sandboxUrl, sandboxId }: PreviewPanelProps) {
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const { data: sandboxStatus } = useSandboxStatus(sandboxId);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refreshPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = sandboxUrl;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-1">
          {(['desktop', 'tablet', 'mobile'] as ViewportMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewport === mode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewport(mode)}
              className="min-w-[44px] min-h-[44px]"
            >
              {mode === 'desktop' && <Monitor className="h-4 w-4" />}
              {mode === 'tablet' && <Tablet className="h-4 w-4" />}
              {mode === 'mobile' && <Smartphone className="h-4 w-4" />}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SandboxStatusBadge status={sandboxStatus?.status || 'unknown'} />
          <Button variant="ghost" size="sm" onClick={refreshPreview} className="min-w-[44px] min-h-[44px]">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Iframe */}
      <div className="flex-1 flex items-start justify-center bg-muted/30 p-4 overflow-auto">
        <div
          className="bg-background border border-border rounded-lg overflow-hidden shadow-sm transition-all duration-300"
          style={{ width: VIEWPORT_SIZES[viewport].width, height: '100%' }}
        >
          {sandboxStatus?.status === 'running' ? (
            <iframe
              ref={iframeRef}
              src={sandboxUrl}
              className="w-full h-full border-0"
              title="WebSmith Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">{t('websmith.preview.starting')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Sandbox Status Badge

```typescript
function SandboxStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    running: { label: 'Running', variant: 'success' as const, icon: Circle },
    creating: { label: 'Starting', variant: 'warning' as const, icon: Loader2 },
    expired: { label: 'Expired', variant: 'destructive' as const, icon: XCircle },
    destroyed: { label: 'Stopped', variant: 'secondary' as const, icon: Square },
    unknown: { label: 'Unknown', variant: 'outline' as const, icon: HelpCircle },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={cn('h-3 w-3', status === 'creating' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}
```

## Model Selector

```typescript
// client/src/components/dashboard/websmith/model-selector.tsx
import { useAiProviders } from '@/hooks/deployment/useAiConfig';

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const { data: providers } = useAiProviders();

  const modelOptions = useMemo(() => {
    if (!providers) return [];
    return providers.flatMap(provider =>
      getModelsForProvider(provider.type).map(model => ({
        value: `${provider.id}:${model.id}`,
        label: model.name,
        provider: provider.name,
        icon: getProviderIcon(provider.type),
      }))
    );
  }, [providers]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-[44px]">
        <SelectValue placeholder={t('websmith.chat.selectModel')} />
      </SelectTrigger>
      <SelectContent>
        {modelOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

## Project List Page

### Table View (MANDATORY)

```typescript
// client/src/components/dashboard/websmith/project-list.tsx

export function ProjectList() {
  const { data: projects, isLoading } = useWebsmithProjects();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('websmith.projects.title')}</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)} className="min-h-[44px]">
            <Plus className="h-4 w-4 me-2" />
            {t('websmith.projects.create')}
          </Button>
        </div>
      </div>

      {/* Table View - NOT card grid */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{t('websmith.projects.name')}</TableHead>
            <TableHead>{t('websmith.projects.mode')}</TableHead>
            <TableHead>{t('websmith.projects.status')}</TableHead>
            <TableHead>{t('websmith.projects.created')}</TableHead>
            <TableHead className="text-end">{t('websmith.projects.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects?.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {project.mode === 'clone' ? (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  )}
                  {project.name}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {project.mode === 'clone' ? t('websmith.modes.clone') : t('websmith.modes.create')}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={project.status === 'deployed' ? 'default' : 'secondary'}>
                  {project.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelativeTime(project.createdAt)}
              </TableCell>
              {/* Inline buttons - NOT dropdown menu */}
              <TableCell className="text-end">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => navigate({ to: '/dashboard/websmith/$projectId', params: { projectId: project.id } })}
                  >
                    {t('websmith.actions.open')}
                  </Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px]">
                    {t('websmith.actions.deploy')}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive min-h-[44px]">
                    {t('websmith.actions.delete')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

## RTL Considerations

### Panel Direction

The `ResizablePanelGroup` with `direction="horizontal"` automatically handles RTL via the `dir` attribute on the HTML element. No manual reversal needed.

### Icons

Directional icons MUST mirror in RTL:

```typescript
<ChevronRight className="h-3 w-3 rtl:scale-x-[-1]" />
<ArrowRight className="h-4 w-4 rtl:scale-x-[-1]" />
```

### Text Alignment

```typescript
// Use logical properties
<TableHead className="text-start">Name</TableHead>
<TableHead className="text-end">Actions</TableHead>
```

## Accessibility

- All interactive elements have 44x44px minimum touch targets
- Chat messages have proper ARIA labels
- File tree supports keyboard navigation
- Preview viewport modes have descriptive labels
- Status badges include text labels (not just colors)
