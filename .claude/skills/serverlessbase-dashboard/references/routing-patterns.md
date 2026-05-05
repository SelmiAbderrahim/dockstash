# ServerlessBase Routing Patterns

## TanStack Router Setup

### Route Structure

```
client/src/routes/_app/_auth/serverlessbase/
├── _layout.tsx                           # Dashboard layout wrapper
├── index.tsx                             # Projects list (default view)
├── project.$projectId/
│   ├── _layout.tsx                       # Project layout
│   ├── index.tsx                         # Project overview
│   └── services/
│       ├── application.$appId.tsx        # Application detail
│       ├── postgres.$dbId.tsx            # PostgreSQL detail
│       ├── mysql.$dbId.tsx               # MySQL detail
│       ├── mongo.$dbId.tsx               # MongoDB detail
│       └── redis.$dbId.tsx               # Redis detail
├── monitoring/
│   ├── index.tsx                         # Monitoring overview
│   └── server.$serverId.tsx              # Server metrics
├── docker/
│   ├── containers.tsx                    # Container list
│   └── images.tsx                        # Image list
└── settings/
    ├── _layout.tsx                       # Settings layout
    ├── profile.tsx                       # User profile
    ├── users.tsx                         # User management
    └── servers.tsx                       # Server settings
```

### Dashboard Layout

```typescript
// routes/_app/_auth/serverlessbase/_layout.tsx
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DashboardSidebar } from "@/components/dashboard/sidebar/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export const Route = createFileRoute("/_app/_auth/serverlessbase/_layout")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Fixed on desktop, drawer on mobile */}
      <DashboardSidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### Projects Index Page

```typescript
// routes/_app/_auth/serverlessbase/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useProjects } from "@/hooks/deployment";
import { ProjectList } from "@/components/dashboard/project/ProjectList";
import { ProjectListSkeleton } from "@/components/dashboard/project/ProjectListSkeleton";
import { ApiErrorBoundary } from "@/components/ApiErrorBoundary";

export const Route = createFileRoute("/_app/_auth/serverlessbase/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();

  if (error) {
    throw error; // Will be caught by ApiErrorBoundary
  }

  return (
    <ApiErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage your deployment projects
            </p>
          </div>
        </div>

        {isLoading ? (
          <ProjectListSkeleton />
        ) : (
          <ProjectList projects={projects?.data ?? []} />
        )}
      </div>
    </ApiErrorBoundary>
  );
}
```

### Project Detail with Params

```typescript
// routes/_app/_auth/serverlessbase/project.$projectId/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useProject, useEnvironments } from "@/hooks/deployment";
import { ProjectOverview } from "@/components/dashboard/project/ProjectOverview";

export const Route = createFileRoute(
  "/_app/_auth/serverlessbase/project/$projectId/"
)({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading: isLoadingProject } = useProject(projectId);
  const { data: environments, isLoading: isLoadingEnvs } = useEnvironments(projectId);

  if (isLoadingProject || isLoadingEnvs) {
    return <ProjectOverviewSkeleton />;
  }

  if (!project) {
    return <NotFound message="Project not found" />;
  }

  return (
    <ProjectOverview
      project={project}
      environments={environments?.data ?? []}
    />
  );
}
```

### Application Service Page

```typescript
// routes/_app/_auth/serverlessbase/project.$projectId/services/application.$appId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useApplication, useApplicationActions } from "@/hooks/deployment";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationGeneral } from "@/components/dashboard/application/ApplicationGeneral";
import { ApplicationLogs } from "@/components/dashboard/application/ApplicationLogs";
import { ApplicationEnvironment } from "@/components/dashboard/application/ApplicationEnvironment";
import { ApplicationDeployments } from "@/components/dashboard/application/ApplicationDeployments";

export const Route = createFileRoute(
  "/_app/_auth/serverlessbase/project/$projectId/services/application/$appId"
)({
  component: ApplicationPage,
});

function ApplicationPage() {
  const { appId } = Route.useParams();
  const { data: application, isLoading } = useApplication(appId);
  const actions = useApplicationActions(appId);

  if (isLoading) {
    return <ApplicationPageSkeleton />;
  }

  if (!application) {
    return <NotFound message="Application not found" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{application.name}</h1>
          <p className="text-muted-foreground">{application.description}</p>
        </div>
        <ActionButtonGroup
          onStart={actions.start}
          onStop={actions.stop}
          onRestart={actions.restart}
          onDeploy={() => actions.deploy()}
          isStarting={actions.isStarting}
          isStopping={actions.isStopping}
          isRestarting={actions.isRestarting}
          isDeploying={actions.isDeploying}
          status={application.status}
        />
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <ApplicationGeneral application={application} />
        </TabsContent>

        <TabsContent value="deployments" className="mt-6">
          <ApplicationDeployments applicationId={appId} />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <ApplicationLogs applicationId={appId} />
        </TabsContent>

        <TabsContent value="environment" className="mt-6">
          <ApplicationEnvironment applicationId={appId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Database Service Page

```typescript
// routes/_app/_auth/serverlessbase/project.$projectId/services/postgres.$dbId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDatabase, useDatabaseConnection, useDatabaseActions } from "@/hooks/deployment";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatabaseGeneral } from "@/components/dashboard/databases/shared/DatabaseGeneral";
import { DatabaseConnection } from "@/components/dashboard/databases/shared/DatabaseConnection";
import { DatabaseBackups } from "@/components/dashboard/databases/shared/DatabaseBackups";
import { DatabaseLogs } from "@/components/dashboard/databases/shared/DatabaseLogs";

export const Route = createFileRoute(
  "/_app/_auth/serverlessbase/project/$projectId/services/postgres/$dbId"
)({
  component: PostgresPage,
});

function PostgresPage() {
  const { dbId } = Route.useParams();
  const { data: database, isLoading } = useDatabase(dbId);
  const { data: connection } = useDatabaseConnection(dbId);
  const actions = useDatabaseActions(dbId);

  if (isLoading) {
    return <DatabasePageSkeleton />;
  }

  if (!database) {
    return <NotFound message="Database not found" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <PostgresIcon className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">{database.name}</h1>
            <p className="text-muted-foreground">PostgreSQL Database</p>
          </div>
        </div>
        <DatabaseActionButtons
          onStart={actions.start}
          onStop={actions.stop}
          onRestart={actions.restart}
          onBackup={actions.createBackup}
          status={database.status}
          isLoading={actions.isLoading}
        />
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <DatabaseGeneral database={database} />
        </TabsContent>

        <TabsContent value="connection" className="mt-6">
          <DatabaseConnection connection={connection} />
        </TabsContent>

        <TabsContent value="backups" className="mt-6">
          <DatabaseBackups databaseId={dbId} />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <DatabaseLogs databaseId={dbId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Monitoring Server Page

```typescript
// routes/_app/_auth/serverlessbase/monitoring/server.$serverId.tsx
import { createFileRoute } from "@tanstack/react-router";
import {
  useServer,
  useServerResources,
  useServerContainers,
} from "@/hooks/deployment";
import { ResourceMetrics } from "@/components/dashboard/monitoring/ResourceMetrics";
import { ContainerList } from "@/components/dashboard/monitoring/ContainerList";
import { MetricsChart } from "@/components/dashboard/monitoring/MetricsChart";

export const Route = createFileRoute(
  "/_app/_auth/serverlessbase/monitoring/server/$serverId"
)({
  component: ServerMonitoringPage,
});

function ServerMonitoringPage() {
  const { serverId } = Route.useParams();
  const { data: server, isLoading: isLoadingServer } = useServer(serverId);
  const { data: resources } = useServerResources(serverId, {
    refetchInterval: 5000,
  });
  const { data: containers } = useServerContainers(serverId, {
    refetchInterval: 10000,
  });

  if (isLoadingServer) {
    return <ServerMonitoringSkeleton />;
  }

  if (!server) {
    return <NotFound message="Server not found" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{server.name}</h1>
          <p className="text-muted-foreground">{server.ip}</p>
        </div>
        <HealthIndicator status={server.status === "online" ? "healthy" : "unhealthy"} />
      </div>

      {/* Resource metrics cards */}
      <ResourceMetrics serverId={serverId} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricsChart
          title="CPU Usage"
          data={resources?.cpuHistory ?? []}
          color="primary"
        />
        <MetricsChart
          title="Memory Usage"
          data={resources?.memoryHistory ?? []}
          color="success"
        />
      </div>

      {/* Container list */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Containers</h2>
        <ContainerList serverId={serverId} containers={containers ?? []} />
      </div>
    </div>
  );
}
```

## Navigation Patterns

### Sidebar Navigation

```typescript
// components/dashboard/sidebar/DashboardSidebar.tsx
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  FolderGit2,
  Activity,
  Container,
  Settings,
  Database,
  Server,
} from "lucide-react";

const navItems = [
  {
    title: "Projects",
    href: "/serverlessbase",
    icon: FolderGit2,
  },
  {
    title: "Monitoring",
    href: "/serverlessbase/monitoring",
    icon: Activity,
  },
  {
    title: "Docker",
    href: "/serverlessbase/docker/containers",
    icon: Container,
  },
  {
    title: "Settings",
    href: "/serverlessbase/settings/profile",
    icon: Settings,
  },
];

export function DashboardSidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 border-e border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Server className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">ServerlessBase</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                "h-[44px]", // Touch target
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### Breadcrumb Navigation

```typescript
// components/dashboard/Breadcrumbs.tsx
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

export function Breadcrumbs() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  // Parse pathname into breadcrumb items
  const segments = pathname
    .replace("/serverlessbase", "")
    .split("/")
    .filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        to="/serverlessbase"
        className="flex items-center gap-1 hover:text-foreground transition-colors h-[44px] px-2"
      >
        <Home className="h-4 w-4" />
      </Link>

      {segments.map((segment, index) => {
        const href = `/serverlessbase/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const label = formatSegment(segment);

        return (
          <div key={segment} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link
                to={href}
                className="hover:text-foreground transition-colors h-[44px] px-2 flex items-center"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function formatSegment(segment: string): string {
  // Convert kebab-case to Title Case
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

## Route Guard Pattern

```typescript
// routes/_app/_auth.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/_auth")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: window.location.pathname,
        },
      });
    }
  },
});
```
