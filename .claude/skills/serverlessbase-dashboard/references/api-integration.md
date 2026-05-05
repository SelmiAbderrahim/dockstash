# ServerlessBase API Integration Patterns

## API Client Architecture

### Base Client Configuration

```typescript
// lib/api/client.ts
export interface ApiClientConfig {
  baseUrl: string;
  apiToken: string;
  timeout?: number;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiClient {
  private config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      apiToken: config.apiToken,
      timeout: config.timeout ?? 30000,
    };
  }

  async get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", signal });
  }

  async post<T>(endpoint: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body, signal });
  }

  async put<T>(endpoint: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: "PUT", body, signal });
  }

  async patch<T>(endpoint: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: "PATCH", body, signal });
  }

  async delete<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", signal });
  }

  private async request<T>(
    endpoint: string,
    options: { method: string; body?: unknown; signal?: AbortSignal }
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal ?? controller.signal,
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseError(response: Response): Promise<ApiClientError> {
    try {
      const data = await response.json();
      return new ApiClientError(
        data.code || "UNKNOWN_ERROR",
        data.message || response.statusText,
        response.status,
        data.details
      );
    } catch {
      return new ApiClientError(
        "PARSE_ERROR",
        response.statusText,
        response.status
      );
    }
  }
}
```

## Service Layer Pattern

### Service Interface

```typescript
// services/deployment/applicationService.ts
import { coolifyClient } from "@/lib/api";
import type {
  Application,
  ApplicationCreateInput,
  ApplicationUpdateInput,
  PaginatedResponse,
  LogEntry,
  EnvironmentVariable,
} from "@/types/deployment";

export const ApplicationService = {
  // List with pagination and filters
  async list(params?: {
    projectId?: string;
    environmentId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Application>> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
    const query = queryParams.toString();
    return coolifyClient.get(`/api/v1/applications${query ? `?${query}` : ""}`);
  },

  // Get single entity
  async get(id: string): Promise<Application> {
    return coolifyClient.get(`/api/v1/applications/${id}`);
  },

  // Create
  async create(input: ApplicationCreateInput): Promise<Application> {
    return coolifyClient.post("/api/v1/applications", input);
  },

  // Update (partial)
  async update(id: string, input: ApplicationUpdateInput): Promise<Application> {
    return coolifyClient.patch(`/api/v1/applications/${id}`, input);
  },

  // Delete
  async delete(id: string): Promise<void> {
    return coolifyClient.delete(`/api/v1/applications/${id}`);
  },

  // Lifecycle actions
  async start(id: string): Promise<Application> {
    return coolifyClient.post(`/api/v1/applications/${id}/start`);
  },

  async stop(id: string): Promise<Application> {
    return coolifyClient.post(`/api/v1/applications/${id}/stop`);
  },

  async restart(id: string): Promise<Application> {
    return coolifyClient.post(`/api/v1/applications/${id}/restart`);
  },

  // Deployment
  async deploy(
    id: string,
    options?: { branch?: string; commit?: string }
  ): Promise<{ deploymentId: string }> {
    return coolifyClient.post(`/api/v1/applications/${id}/deploy`, options);
  },

  // Related resources
  async getLogs(
    id: string,
    params?: { lines?: number; since?: string }
  ): Promise<LogEntry[]> {
    const queryParams = new URLSearchParams();
    if (params?.lines) queryParams.append("lines", String(params.lines));
    if (params?.since) queryParams.append("since", params.since);
    const query = queryParams.toString();
    return coolifyClient.get(`/api/v1/applications/${id}/logs${query ? `?${query}` : ""}`);
  },

  async getEnvironment(id: string): Promise<EnvironmentVariable[]> {
    return coolifyClient.get(`/api/v1/applications/${id}/environment`);
  },

  async updateEnvironment(
    id: string,
    variables: EnvironmentVariable[]
  ): Promise<EnvironmentVariable[]> {
    return coolifyClient.put(`/api/v1/applications/${id}/environment`, { variables });
  },
};
```

## Query Key Factory Pattern

```typescript
// hooks/deployment/queryKeys.ts
export const deploymentKeys = {
  all: ["deployment"] as const,

  // Applications
  applications: {
    all: () => [...deploymentKeys.all, "applications"] as const,
    lists: () => [...deploymentKeys.applications.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...deploymentKeys.applications.lists(), filters] as const,
    details: () => [...deploymentKeys.applications.all(), "detail"] as const,
    detail: (id: string) => [...deploymentKeys.applications.details(), id] as const,
    logs: (id: string) => [...deploymentKeys.applications.detail(id), "logs"] as const,
    environment: (id: string) =>
      [...deploymentKeys.applications.detail(id), "environment"] as const,
  },

  // Databases
  databases: {
    all: () => [...deploymentKeys.all, "databases"] as const,
    lists: () => [...deploymentKeys.databases.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...deploymentKeys.databases.lists(), filters] as const,
    details: () => [...deploymentKeys.databases.all(), "detail"] as const,
    detail: (id: string) => [...deploymentKeys.databases.details(), id] as const,
    connection: (id: string) =>
      [...deploymentKeys.databases.detail(id), "connection"] as const,
    backups: (id: string) =>
      [...deploymentKeys.databases.detail(id), "backups"] as const,
  },

  // Deployments
  deployments: {
    all: () => [...deploymentKeys.all, "deployments"] as const,
    lists: () => [...deploymentKeys.deployments.all(), "list"] as const,
    list: (appId: string, filters?: Record<string, unknown>) =>
      [...deploymentKeys.deployments.lists(), appId, filters] as const,
    details: () => [...deploymentKeys.deployments.all(), "detail"] as const,
    detail: (id: string) => [...deploymentKeys.deployments.details(), id] as const,
    logs: (id: string) => [...deploymentKeys.deployments.detail(id), "logs"] as const,
  },

  // Projects
  projects: {
    all: () => [...deploymentKeys.all, "projects"] as const,
    lists: () => [...deploymentKeys.projects.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...deploymentKeys.projects.lists(), filters] as const,
    details: () => [...deploymentKeys.projects.all(), "detail"] as const,
    detail: (id: string) => [...deploymentKeys.projects.details(), id] as const,
  },

  // Environments
  environments: {
    all: () => [...deploymentKeys.all, "environments"] as const,
    list: (projectId: string) =>
      [...deploymentKeys.environments.all(), "list", projectId] as const,
    detail: (id: string) =>
      [...deploymentKeys.environments.all(), "detail", id] as const,
    services: (id: string) =>
      [...deploymentKeys.environments.detail(id), "services"] as const,
  },

  // Servers
  servers: {
    all: () => [...deploymentKeys.all, "servers"] as const,
    lists: () => [...deploymentKeys.servers.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...deploymentKeys.servers.lists(), filters] as const,
    details: () => [...deploymentKeys.servers.all(), "detail"] as const,
    detail: (id: string) => [...deploymentKeys.servers.details(), id] as const,
    resources: (id: string) =>
      [...deploymentKeys.servers.detail(id), "resources"] as const,
    containers: (id: string) =>
      [...deploymentKeys.servers.detail(id), "containers"] as const,
  },

  // Monitoring
  monitoring: {
    all: () => [...deploymentKeys.all, "monitoring"] as const,
    serverMetrics: (serverId: string) =>
      [...deploymentKeys.monitoring.all(), "server", serverId] as const,
    containerMetrics: (containerId: string) =>
      [...deploymentKeys.monitoring.all(), "container", containerId] as const,
  },
} as const;

export type DeploymentQueryKey = ReturnType<
  | (typeof deploymentKeys.applications)[keyof typeof deploymentKeys.applications]
  | (typeof deploymentKeys.databases)[keyof typeof deploymentKeys.databases]
  | (typeof deploymentKeys.deployments)[keyof typeof deploymentKeys.deployments]
  | (typeof deploymentKeys.projects)[keyof typeof deploymentKeys.projects]
  | (typeof deploymentKeys.servers)[keyof typeof deploymentKeys.servers]
>;
```

## React Query Hook Patterns

### Query Hook

```typescript
// hooks/deployment/useApplications.ts
import { useQuery } from "@tanstack/react-query";
import { ApplicationService } from "@/services/deployment";
import { deploymentKeys } from "./queryKeys";

interface UseApplicationsOptions {
  projectId?: string;
  environmentId?: string;
  status?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useApplications(options: UseApplicationsOptions = {}) {
  const { enabled = true, ...params } = options;

  return useQuery({
    queryKey: deploymentKeys.applications.list(params),
    queryFn: () => ApplicationService.list(params),
    enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useApplication(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: deploymentKeys.applications.detail(id),
    queryFn: () => ApplicationService.get(id),
    enabled: options?.enabled !== false && Boolean(id),
    staleTime: 1000 * 30,
  });
}

export function useApplicationLogs(
  id: string,
  params?: { lines?: number },
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey: deploymentKeys.applications.logs(id),
    queryFn: () => ApplicationService.getLogs(id, params),
    enabled: options?.enabled !== false && Boolean(id),
    refetchInterval: options?.refetchInterval,
  });
}
```

### Mutation Hook with Optimistic Updates

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApplicationService } from "@/services/deployment";
import { deploymentKeys } from "./queryKeys";
import type { Application, ApplicationUpdateInput } from "@/types/deployment";

export function useUpdateApplication(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplicationUpdateInput) =>
      ApplicationService.update(id, input),

    // Optimistic update
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: deploymentKeys.applications.detail(id),
      });

      // Snapshot previous value
      const previousApp = queryClient.getQueryData<Application>(
        deploymentKeys.applications.detail(id)
      );

      // Optimistically update cache
      if (previousApp) {
        queryClient.setQueryData(deploymentKeys.applications.detail(id), {
          ...previousApp,
          ...newData,
        });
      }

      // Return context for rollback
      return { previousApp };
    },

    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousApp) {
        queryClient.setQueryData(
          deploymentKeys.applications.detail(id),
          context.previousApp
        );
      }
    },

    // Refetch after mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: deploymentKeys.applications.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: deploymentKeys.applications.lists(),
      });
    },
  });
}
```

### Action Hooks Pattern

```typescript
export function useApplicationActions(id: string) {
  const queryClient = useQueryClient();

  const invalidateApp = () => {
    queryClient.invalidateQueries({
      queryKey: deploymentKeys.applications.detail(id),
    });
    queryClient.invalidateQueries({
      queryKey: deploymentKeys.applications.lists(),
    });
  };

  const startMutation = useMutation({
    mutationFn: () => ApplicationService.start(id),
    onSuccess: invalidateApp,
  });

  const stopMutation = useMutation({
    mutationFn: () => ApplicationService.stop(id),
    onSuccess: invalidateApp,
  });

  const restartMutation = useMutation({
    mutationFn: () => ApplicationService.restart(id),
    onSuccess: invalidateApp,
  });

  const deployMutation = useMutation({
    mutationFn: (options?: { branch?: string }) =>
      ApplicationService.deploy(id, options),
    onSuccess: () => {
      invalidateApp();
      // Also invalidate deployments list
      queryClient.invalidateQueries({
        queryKey: deploymentKeys.deployments.lists(),
      });
    },
  });

  return {
    // Actions
    start: startMutation.mutate,
    stop: stopMutation.mutate,
    restart: restartMutation.mutate,
    deploy: deployMutation.mutate,

    // Async versions
    startAsync: startMutation.mutateAsync,
    stopAsync: stopMutation.mutateAsync,
    restartAsync: restartMutation.mutateAsync,
    deployAsync: deployMutation.mutateAsync,

    // Loading states
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isRestarting: restartMutation.isPending,
    isDeploying: deployMutation.isPending,
    isLoading:
      startMutation.isPending ||
      stopMutation.isPending ||
      restartMutation.isPending ||
      deployMutation.isPending,

    // Error states
    startError: startMutation.error,
    stopError: stopMutation.error,
    restartError: restartMutation.error,
    deployError: deployMutation.error,
  };
}
```

## Error Handling Pattern

```typescript
// components/ApiErrorBoundary.tsx
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

function ApiErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="p-4 bg-destructive/10 rounded-full mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {error.message}
      </p>
      <Button onClick={resetErrorBoundary} variant="outline">
        <RotateCcw className="h-4 w-4 me-2" />
        Try again
      </Button>
    </div>
  );
}

export function ApiErrorBoundary({ children }: { children: React.ReactNode }) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary FallbackComponent={ApiErrorFallback} onReset={reset}>
      {children}
    </ErrorBoundary>
  );
}
```

## Coolify API Reference

### Endpoints

```
Applications:
  GET    /api/v1/applications
  POST   /api/v1/applications
  GET    /api/v1/applications/:id
  PATCH  /api/v1/applications/:id
  DELETE /api/v1/applications/:id
  POST   /api/v1/applications/:id/start
  POST   /api/v1/applications/:id/stop
  POST   /api/v1/applications/:id/restart
  POST   /api/v1/applications/:id/deploy
  GET    /api/v1/applications/:id/logs
  GET    /api/v1/applications/:id/environment

Databases:
  GET    /api/v1/databases
  POST   /api/v1/databases
  GET    /api/v1/databases/:id
  PATCH  /api/v1/databases/:id
  DELETE /api/v1/databases/:id
  GET    /api/v1/databases/:id/connection
  POST   /api/v1/databases/:id/start
  POST   /api/v1/databases/:id/stop
  POST   /api/v1/databases/:id/backup
  GET    /api/v1/databases/:id/backups
  POST   /api/v1/databases/:id/restore/:backupId

Deployments:
  GET    /api/v1/deployments
  GET    /api/v1/deployments/:id
  GET    /api/v1/deployments/:id/logs
  POST   /api/v1/deployments/:id/cancel
  POST   /api/v1/deployments/:id/rollback

Projects:
  GET    /api/v1/projects
  POST   /api/v1/projects
  GET    /api/v1/projects/:id
  PATCH  /api/v1/projects/:id
  DELETE /api/v1/projects/:id
  GET    /api/v1/projects/:id/environments

Servers:
  GET    /api/v1/servers
  GET    /api/v1/servers/:id
  GET    /api/v1/servers/:id/resources
  GET    /api/v1/servers/:id/containers
  GET    /api/v1/servers/:id/containers/:containerId/metrics
```

## Proxy Operations

### Proxy Detection and Management

ServerlessBase supports two reverse proxy types: **Traefik** (Docker-native) and **Nginx** (traditional). The unified domain manager routes operations to the appropriate proxy.

### tRPC Procedures (Server Router)

```typescript
// serverlessbase/apps/serverlessbase/server/api/routers/server.ts

// Proxy Detection
detectProxy: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .mutation(async ({ input }) => {
    // Returns: "traefik" | "nginx" | null
  });

getProxyStatus: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .query(async ({ input }) => {
    // Returns: { configured, detected, detectedAt, effectiveType }
  });

// Nginx Operations
getNginxStatus: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .query(async ({ input }) => {
    // Returns: { isRunning, version }
  });

listNginxConfigs: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .query(async ({ input }) => {
    // Returns: Array<{ name, enabled }>
  });

readNginxConfig: adminProcedure
  .input(z.object({ serverId: z.string(), configName: z.string() }))
  .query(async ({ input }) => {
    // Returns: { name, content, enabled }
  });

writeNginxConfig: adminProcedure
  .input(z.object({ serverId, configName, content, enable?: boolean }))
  .mutation(async ({ input }) => {
    // Returns: { success, message }
  });

validateNginxConfig: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .mutation(async ({ input }) => {
    // Returns: { valid, output }
  });

reloadNginx: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .mutation(async ({ input }) => {
    // Returns: { success, message }
  });

// SSL Certificates
getCertificateStatus: adminProcedure
  .input(z.object({ serverId, domain }))
  .query(async ({ input }) => {
    // Returns: { status, expiresAt, daysRemaining, isManaged }
  });

requestCertificate: adminProcedure
  .input(z.object({ serverId, domain, email, staging?: boolean }))
  .mutation(async ({ input }) => {
    // Returns: { success, message, output }
  });

listCertificates: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .query(async ({ input }) => {
    // Returns: Array<{ domain, expiresAt, daysRemaining, status }>
  });

renewCertificates: adminProcedure
  .input(z.object({ serverId: z.string() }))
  .mutation(async ({ input }) => {
    // Returns: { success, renewed, failed, output }
  });
```

### Frontend Service (NginxService)

```typescript
// client/src/services/deployment/nginxService.ts
import { trpcQuery, trpcMutation } from "@/lib/api/dokploy";

export const NginxService = {
  // Proxy operations
  detectProxy: (serverId: string) =>
    trpcMutation("server", "detectProxy", { serverId }),

  getProxyStatus: (serverId: string) =>
    trpcQuery("server", "getProxyStatus", { serverId }),

  // Nginx operations
  getNginxStatus: (serverId: string) =>
    trpcQuery("server", "getNginxStatus", { serverId }),

  listNginxConfigs: (serverId: string) =>
    trpcQuery("server", "listNginxConfigs", { serverId }),

  readNginxConfig: (serverId: string, configName: string) =>
    trpcQuery("server", "readNginxConfig", { serverId, configName }),

  writeNginxConfig: (serverId: string, configName: string, content: string, enable?: boolean) =>
    trpcMutation("server", "writeNginxConfig", { serverId, configName, content, enable }),

  validateNginxConfig: (serverId: string) =>
    trpcMutation("server", "validateNginxConfig", { serverId }),

  reloadNginx: (serverId: string) =>
    trpcMutation("server", "reloadNginx", { serverId }),

  // Certificate operations
  getCertificateStatus: (serverId: string, domain: string) =>
    trpcQuery("server", "getCertificateStatus", { serverId, domain }),

  requestCertificate: (serverId: string, domain: string, email: string, staging = false) =>
    trpcMutation("server", "requestCertificate", { serverId, domain, email, staging }),

  listCertificates: (serverId: string) =>
    trpcQuery("server", "listCertificates", { serverId }),

  renewCertificates: (serverId: string) =>
    trpcMutation("server", "renewCertificates", { serverId }),
};
```

### Query Key Factory (Proxy/Nginx Keys)

```typescript
// client/src/hooks/deployment/queryKeys.ts
export const deploymentKeys = {
  // ... existing keys

  proxy: {
    all: () => [...deploymentKeys.all, "proxy"] as const,
    status: (serverId: string) => [...deploymentKeys.proxy.all(), "status", serverId] as const,
  },

  nginx: {
    all: () => [...deploymentKeys.all, "nginx"] as const,
    status: (serverId: string) => [...deploymentKeys.nginx.all(), "status", serverId] as const,
    configs: (serverId: string) => [...deploymentKeys.nginx.all(), "configs", serverId] as const,
    config: (serverId: string, name: string) =>
      [...deploymentKeys.nginx.configs(serverId), name] as const,
  },

  certificates: {
    all: () => [...deploymentKeys.all, "certificates"] as const,
    list: (serverId: string) => [...deploymentKeys.certificates.all(), "list", serverId] as const,
    status: (serverId: string, domain: string) =>
      [...deploymentKeys.certificates.all(), "status", serverId, domain] as const,
  },
};
```

### React Query Hooks

```typescript
// client/src/hooks/deployment/useNginx.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NginxService } from "@/services/deployment";
import { deploymentKeys } from "./queryKeys";

// Query hooks
export function useProxyStatus(serverId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: deploymentKeys.proxy.status(serverId),
    queryFn: () => NginxService.getProxyStatus(serverId),
    enabled: Boolean(serverId) && options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useNginxStatus(serverId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: deploymentKeys.nginx.status(serverId),
    queryFn: () => NginxService.getNginxStatus(serverId),
    enabled: Boolean(serverId) && options?.enabled !== false,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  });
}

export function useNginxConfigs(serverId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: deploymentKeys.nginx.configs(serverId),
    queryFn: () => NginxService.listNginxConfigs(serverId),
    enabled: Boolean(serverId) && options?.enabled !== false,
    staleTime: 10 * 1000,
  });
}

export function useServerCertificates(serverId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: deploymentKeys.certificates.list(serverId),
    queryFn: () => NginxService.listCertificates(serverId),
    enabled: Boolean(serverId) && options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

// Mutation hooks
export function useDetectProxy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => NginxService.detectProxy(serverId),
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.proxy.status(serverId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.servers.detail(serverId) });
    },
  });
}

export function useReloadNginx() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => NginxService.reloadNginx(serverId),
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.nginx.status(serverId) });
    },
  });
}

export function useRequestCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, domain, email, staging }: {
      serverId: string;
      domain: string;
      email: string;
      staging?: boolean;
    }) => NginxService.requestCertificate(serverId, domain, email, staging),
    onSuccess: (_, { serverId, domain }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.certificates.list(serverId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.certificates.status(serverId, domain) });
    },
  });
}
```

### Proxy-Aware Component Pattern

```typescript
// Always check proxy type before showing SSL options
import { useProxyStatus } from "@/hooks/deployment/useNginx";

function DomainSettings({ serverId }: { serverId: string }) {
  const { data: proxyStatus } = useProxyStatus(serverId);

  const effectiveProxy = proxyStatus?.effectiveType;
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
      {/* Domain form */}
    </div>
  );
}
```

See `.claude/skills/nginx-proxy-management/SKILL.md` for complete Nginx patterns.
