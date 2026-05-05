---
name: serverlessbase-dashboard
description: Comprehensive guide for building ServerlessBase deployment dashboard (Dokploy-inspired) with Coolify API integration, STYLES.md compliance, and enterprise-grade quality standards. Use when creating dashboard components, implementing deployment features, or building monitoring interfaces for the React + TypeScript + TanStack stack.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "deployment-dashboard"
  dependencies: "react@18+, typescript, tailwindcss, shadcn/ui, tanstack-query, tanstack-router, recharts"
  project: "ServerlessBase - Coolify-Powered Deployment Platform"
---

# ServerlessBase Dashboard Development Guide

## Overview

This skill provides comprehensive guidelines for building the ServerlessBase deployment dashboard - a Dokploy-inspired interface that connects to Coolify API for managing applications, databases, servers, and deployments.

**Keywords**: serverlessbase, deployment, dashboard, coolify, dokploy, applications, databases, monitoring, docker, containers, servers, logs, metrics

**Project Context**: React 18 + TypeScript strict + TanStack Router + TanStack React Query + Shadcn UI + Recharts, connecting to Coolify REST API backend.

## When to Use This Skill

- **Dashboard Development**: When creating ServerlessBase dashboard components
- **API Integration**: When implementing Coolify API service layers
- **Monitoring UI**: When building metrics charts and log viewers
- **Deployment Features**: When implementing deploy, rollback, restart functionality
- **Database Management**: When building database CRUD interfaces
- **Docker Management**: When creating container/image management UI
- **Project Management**: When implementing project/environment organization

## Architecture Overview

### Project Structure

```
client/src/
├── lib/api/
│   ├── client.ts          # Base HTTP client with auth, errors
│   ├── coolify.ts         # Coolify client instance
│   └── index.ts
├── types/
│   ├── deployment.ts      # All deployment-related types
│   └── index.ts
├── services/deployment/
│   ├── applicationService.ts
│   ├── databaseService.ts
│   ├── deploymentService.ts
│   ├── projectService.ts
│   ├── serverService.ts
│   └── index.ts
├── hooks/deployment/
│   ├── queryKeys.ts       # Query key factory
│   ├── useApplications.ts
│   ├── useDatabases.ts
│   ├── useDeployments.ts
│   ├── useProjects.ts
│   ├── useServers.ts
│   └── index.ts
├── components/dashboard/
│   ├── sidebar/
│   ├── project/
│   ├── services/
│   ├── application/
│   ├── databases/
│   ├── docker/
│   ├── monitoring/
│   └── settings/
└── routes/_app/_auth/serverlessbase/
    ├── _layout.tsx
    ├── index.tsx
    ├── project.$projectId/
    ├── monitoring/
    ├── docker/
    └── settings/
```

### API Integration Flow

```
React Component
     ↓
React Query Hook (useApplications)
     ↓
Service Layer (ApplicationService)
     ↓
API Client (coolifyClient)
     ↓
Coolify REST API
```

## Process / Workflow

### Step 1: Environment Configuration

Ensure Coolify environment variables are set:

```bash
# Root .env file
VITE_COOLIFY_BASE_URL=http://localhost:8000
VITE_COOLIFY_API_TOKEN=your_token_here
```

### Step 2: API Service Implementation

Create services following this pattern:

```typescript
// services/deployment/applicationService.ts
import { coolifyClient } from "@/lib/api";
import type { Application, ApplicationCreateInput, PaginatedResponse } from "@/types/deployment";

export const ApplicationService = {
  async list(params?: { projectId?: string; page?: number }): Promise<PaginatedResponse<Application>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.append("projectId", params.projectId);
    if (params?.page) query.append("page", String(params.page));
    return coolifyClient.get(`/api/v1/applications${query.toString() ? `?${query}` : ""}`);
  },

  async get(id: string): Promise<Application> {
    return coolifyClient.get(`/api/v1/applications/${id}`);
  },

  async create(input: ApplicationCreateInput): Promise<Application> {
    return coolifyClient.post("/api/v1/applications", input);
  },

  async start(id: string): Promise<Application> {
    return coolifyClient.post(`/api/v1/applications/${id}/start`);
  },

  // ... more methods
};
```

### Step 3: React Query Hook Implementation

Create hooks with proper caching:

```typescript
// hooks/deployment/useApplications.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApplicationService } from "@/services/deployment";
import { deploymentKeys } from "./queryKeys";

export function useApplications(options: UseApplicationsOptions = {}) {
  const { enabled = true, ...params } = options;

  return useQuery({
    queryKey: deploymentKeys.applications.list(params),
    queryFn: () => ApplicationService.list(params),
    enabled,
    staleTime: 1000 * 30,
  });
}

export function useApplicationActions(id: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: deploymentKeys.applications.detail(id),
    });
    queryClient.invalidateQueries({
      queryKey: deploymentKeys.applications.lists(),
    });
  };

  const startMutation = useMutation({
    mutationFn: () => ApplicationService.start(id),
    onSuccess: invalidate,
  });

  return {
    start: startMutation.mutate,
    isStarting: startMutation.isPending,
    // ... more actions
  };
}
```

### Step 4: Component Implementation

Build components with STYLES.md compliance:

```typescript
// components/dashboard/services/ServiceCard.tsx
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApplicationActions } from "@/hooks/deployment";
import { Play, Square, RotateCcw } from "lucide-react";

interface ServiceCardProps {
  application: Application;
}

export function ServiceCard({ application }: ServiceCardProps) {
  const { start, stop, restart, isLoading } = useApplicationActions(application.id);

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg truncate">{application.name}</CardTitle>
          <StatusBadge status={application.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {application.description}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => start()}
            disabled={isLoading}
          >
            <Play className="h-4 w-4 me-1" />
            Start
          </Button>
          {/* More buttons */}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 5: Route Implementation

Create routes with TanStack Router:

```typescript
// routes/_app/_auth/serverlessbase/_layout.tsx
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DashboardSidebar } from "@/components/dashboard/sidebar/DashboardSidebar";

export const Route = createFileRoute("/_app/_auth/serverlessbase/_layout")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="flex h-screen">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

## Guidelines

### RTL Compliance (MANDATORY)

**NEVER use physical properties:**

| FORBIDDEN | REQUIRED |
|-----------|----------|
| `ml-*`, `mr-*` | `ms-*`, `me-*` |
| `pl-*`, `pr-*` | `ps-*`, `pe-*` |
| `left-*`, `right-*` | `start-*`, `end-*` |
| `text-left`, `text-right` | `text-start`, `text-end` |
| `space-x-*` | `gap-*` |

```typescript
// CORRECT
<div className="flex gap-4 ps-4 pe-2 text-start">
  <span className="ms-2">Content</span>
</div>

// WRONG
<div className="flex space-x-4 pl-4 pr-2 text-left">
  <span className="ml-2">Content</span>
</div>
```

### CSS Custom Properties (MANDATORY)

Always use semantic tokens:

```typescript
// CORRECT
<Card className="bg-card text-card-foreground border-border shadow-sm" />

// WRONG
<div style={{ backgroundColor: "#ffffff", color: "#0a0a0a" }} />
```

### Mobile-First Responsive Design

Start with mobile, enhance for larger screens:

```typescript
// CORRECT
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">

// WRONG
<div className="grid grid-cols-3 lg:grid-cols-2 md:grid-cols-1 gap-6 sm:gap-4">
```

### Touch Targets

Minimum 44x44px for interactive elements:

```typescript
<Button className="h-[44px] min-w-[44px]">Action</Button>
```

### Dark Mode Support

All components must support dark mode automatically through CSS custom properties:

```typescript
// Colors automatically adapt
<Badge className="bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300">
  Running
</Badge>
```

### Query Key Factory Pattern

Use hierarchical query keys:

```typescript
export const deploymentKeys = {
  all: ["deployment"] as const,
  applications: {
    all: () => [...deploymentKeys.all, "applications"] as const,
    lists: () => [...deploymentKeys.applications.all(), "list"] as const,
    list: (filters) => [...deploymentKeys.applications.lists(), filters] as const,
    detail: (id: string) => [...deploymentKeys.applications.details(), id] as const,
    logs: (id: string) => [...deploymentKeys.applications.detail(id), "logs"] as const,
  },
  // ... more entities
};
```

### Proxy Type Awareness

When building domain or SSL features, always consider the server's proxy type:

```typescript
import { useProxyStatus, useDetectProxy } from "@/hooks/deployment/useNginx";

function DomainSettings({ serverId }: { serverId: string }) {
  const { data: proxyStatus } = useProxyStatus(serverId);

  const effectiveProxy = proxyStatus?.effectiveType;

  // Traefik handles SSL automatically via Docker labels
  // Nginx requires Certbot for SSL certificates
  const needsManualSSL = effectiveProxy === "nginx";

  return (
    <div>
      {needsManualSSL && (
        <Alert>
          <AlertDescription>
            SSL certificates for this server are managed via Certbot.
            Use the certificate request button to obtain certificates.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

**Key proxy-aware patterns:**
- Check `proxyStatus.effectiveType` before showing SSL options
- Traefik: SSL automatic via ACME, domain routing via Docker labels
- Nginx: SSL via Certbot, domain routing via site configs
- Auto: Use `useDetectProxy` to determine actual proxy type

See `.claude/rules/nginx-proxy-patterns.md` for comprehensive proxy patterns.

### Optimistic Updates

Implement for better UX:

```typescript
useMutation({
  mutationFn: (input) => ApplicationService.update(id, input),
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: deploymentKeys.applications.detail(id) });
    const previous = queryClient.getQueryData(deploymentKeys.applications.detail(id));
    queryClient.setQueryData(deploymentKeys.applications.detail(id), { ...previous, ...newData });
    return { previous };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(deploymentKeys.applications.detail(id), context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: deploymentKeys.applications.detail(id) });
  },
});
```

## Examples

### Example 1: Project List Component

```typescript
import { useProjects } from "@/hooks/deployment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderGit2, Plus } from "lucide-react";

export function ProjectList() {
  const { data: projects, isLoading, error } = useProjects();

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        Failed to load projects: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button>
          <Plus className="h-4 w-4 me-2" />
          New Project
        </Button>
      </div>

      {projects?.data.length === 0 ? (
        <div className="text-center py-12">
          <FolderGit2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first project to get started
          </p>
          <Button>Create Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.data.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Example 2: Database Connection Display

```typescript
import { useDatabaseConnection } from "@/hooks/deployment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Eye, EyeOff } from "lucide-react";

export function DatabaseConnection({ databaseId }: { databaseId: string }) {
  const { data: connection, isLoading } = useDatabaseConnection(databaseId);
  const [showPassword, setShowPassword] = useState(false);

  if (isLoading || !connection) return <ConnectionSkeleton />;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Host</Label>
          <div className="flex gap-2">
            <Input value={connection.host} readOnly />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(connection.host)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Port</Label>
            <Input value={String(connection.port)} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Database</Label>
            <Input value={connection.database} readOnly />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Username</Label>
          <Input value={connection.username} readOnly />
        </div>

        <div className="space-y-2">
          <Label>Password</Label>
          <div className="flex gap-2">
            <Input
              type={showPassword ? "text" : "password"}
              value={connection.password}
              readOnly
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(connection.password)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Connection String</Label>
          <div className="flex gap-2">
            <Input
              type={showPassword ? "text" : "password"}
              value={connection.connectionString}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(connection.connectionString)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Example 3: Deployment History

```typescript
import { useDeployments } from "@/hooks/deployment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, GitBranch, User, RotateCcw } from "lucide-react";

export function DeploymentHistory({ applicationId }: { applicationId: string }) {
  const { data: deployments, isLoading } = useDeployments(applicationId);

  if (isLoading) return <DeploymentHistorySkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border">
            {deployments?.data.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-start gap-4 p-4 hover:bg-muted/50"
              >
                <StatusIndicator status={deployment.status} />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {deployment.commitMessage || "Manual deployment"}
                    </span>
                    <DeploymentStatusBadge status={deployment.status} />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {deployment.branch && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {deployment.branch}
                      </span>
                    )}
                    {deployment.triggeredBy && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {deployment.triggeredBy}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(deployment.startedAt)}
                    </span>
                  </div>

                  {deployment.commitSha && (
                    <code className="text-xs text-muted-foreground">
                      {deployment.commitSha.slice(0, 7)}
                    </code>
                  )}
                </div>

                {deployment.status === "completed" && (
                  <Button variant="ghost" size="sm">
                    <RotateCcw className="h-4 w-4 me-1" />
                    Rollback
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

## Reference Files

- [API Service Patterns](./references/api-integration.md) - Coolify API client patterns
- [Component Patterns](./references/component-patterns.md) - RTL-safe component templates
- [Routing Patterns](./references/routing-patterns.md) - TanStack Router patterns

## Assets

- [Status Badge Template](./assets/component-templates/status-badge.tsx)
- [Service Card Template](./assets/component-templates/service-card.tsx)
- [Metrics Chart Template](./assets/component-templates/metrics-chart.tsx)

## Docker-Only Execution

**ALL commands must run via Docker:**

```bash
# CORRECT
make start
make shell-client
make test

# WRONG
npm run dev
npm test
```

## Design Differentiation Rules (MANDATORY)

The client dashboard (port 48080) MUST look different from ServerlessBase Main App (port 38291).

### Services Architecture
| Service | Port | Description |
|---------|------|-------------|
| Client Dashboard | 48080 | Custom React frontend (this project) |
| Main App | 38291 | Original Dokploy/ServerlessBase (Next.js) |

### Navigation Layout
- **Main App**: Left floating sidebar with icon collapse
- **Client**: Use layout from `VITE_NAV_LAYOUT` env var (top-nav default)

Available layouts: `original`, `top-nav`, `left-rail`, `right-sidebar`, `tabs`

```typescript
import { LayoutSelector } from '@/components/layouts';
import { layoutConfig } from '@/config/layout';

// Automatic layout based on env var
<LayoutSelector user={user} onLogout={logout}>
  {children}
</LayoutSelector>
```

### Project/Service Lists
- **Main App**: Card grid (`grid-cols-1 lg:grid-cols-2 xl:grid-cols-3`)
- **Client**: Table view by default, user can switch via ViewModeSelector

Available views: `grid`, `table`, `list`, `compact-cards`

```typescript
import { TableView, ViewModeSelector, useViewMode } from '@/components/views';
import { layoutConfig } from '@/config/layout';

const [viewMode, setViewMode] = useViewMode('projects', layoutConfig.defaultViewMode);

// View mode toggle
<ViewModeSelector value={viewMode} onChange={setViewMode} />

// Render based on view mode
{viewMode === 'table' && <TableView items={projects} columns={columns} actions={actions} />}
{viewMode === 'list' && <ListView items={projects} renderItem={renderProject} actions={actions} />}
```

### Actions Pattern
- **Main App**: 3-dot dropdown menus (`<DropdownMenu>` with `...` trigger)
- **Client**: Inline button row (always visible action buttons)

```typescript
// ❌ WRONG - Main app pattern
<DropdownMenu>
  <DropdownMenuTrigger>
    <MoreHorizontal />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={edit}>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={delete}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// ✅ CORRECT - Client pattern (inline buttons)
<div className="flex items-center gap-1">
  <Button variant="ghost" size="sm" onClick={edit}>
    <Edit className="h-4 w-4 me-1" />
    Edit
  </Button>
  <Button variant="ghost" size="sm" onClick={delete} className="text-destructive">
    <Trash className="h-4 w-4 me-1" />
    Delete
  </Button>
</div>
```

### Before Creating Any Component
1. Check if main app has similar component at port 38291
2. Implement using DIFFERENT layout pattern
3. Use inline actions, not dropdown menus
4. Prefer table/list views over card grids
5. Import and use layout config from `@/config/layout`

## Quality Standards

- TypeScript strict mode (MANDATORY)
- 90%+ test coverage
- 100% Shadcn design system compliance
- Zero security vulnerabilities
- Performance: FCP <1.5s, LCP <2.5s, TTI <3.5s
- Docker-only development
- WCAG 2.1 AA accessibility
- Touch targets 44x44px minimum
- Design differentiation from main app (MANDATORY)

## Related Agents

- `serverlessbase-frontend-expert` - Dashboard component development
- `serverlessbase-api-integration` - Coolify API connectivity
- `serverlessbase-monitoring-ui` - Monitoring visualization

## Troubleshooting

**Problem**: API requests failing with 401
**Solution**: Verify VITE_COOLIFY_API_TOKEN is set correctly in root .env

**Problem**: Types not matching API response
**Solution**: Check `/client/src/types/deployment.ts` against Coolify API docs

**Problem**: Query cache not updating
**Solution**: Ensure proper query key invalidation in mutations

**Problem**: Components not RTL-safe
**Solution**: Run `npm run rtl:check` and replace physical properties with logical ones

---

**Remember**: This skill enforces enterprise-grade deployment dashboard standards. Always validate STYLES.md compliance and ensure proper API integration patterns.
