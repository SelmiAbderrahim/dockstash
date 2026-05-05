# Bug Fixes: Deployment History & Build Types

## Overview

**COMPLETED:** PR Preview Environments fix, Deployment History basic display fix

**CURRENT:** Fix remaining deployment issues and add Build Type support:
1. Fix 404 error on `deployment.getDeployments` endpoint (View Full Logs button)
2. Add WebSocket streaming for deployment logs (like main app)
3. Add Build Type display to client dashboard
4. Add "Command execution" build type to backend schema AND client

---

## Bug 3: 404 on View Full Logs (CRITICAL)

### Root Cause
`client/src/services/deployment/deploymentService.ts` line 117 uses non-existent endpoint:

```typescript
// ❌ WRONG - This endpoint doesn't exist
async getLogs(applicationId: string): Promise<string> {
  return trpcQuery<string>("deployment", "getDeployments", { applicationId });
}
```

### Fix
Use correct tRPC endpoint and parameter name:

**File:** `client/src/services/deployment/deploymentService.ts`
```typescript
// ✅ CORRECT - Use deployment.allByType for log history
async getLogs(applicationId: string): Promise<string> {
  // For full logs, we need to fetch via logPath and read the file
  // The main app uses WebSocket streaming - we'll implement that
  const deployments = await trpcQuery<BackendDeployment[]>("deployment", "allByType", {
    id: applicationId,
    type: "application"
  });
  // Return most recent deployment's logs or empty
  return deployments[0]?.logPath || "";
}
```

---

## Feature 1: WebSocket Deployment Log Streaming

### Main App Pattern
`serverlessbase/apps/serverlessbase/components/dashboard/application/deployments/show-deployment.tsx`:

```typescript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/listen-deployment?logPath=${logPath}${serverId ? `&serverId=${serverId}` : ""}`;
const ws = new WebSocket(wsUrl);
ws.onmessage = (e) => {
  setData((currentData) => currentData + e.data);
};
```

### Implementation
Create streaming log viewer using WebSocket to `/listen-deployment` endpoint.

**New Files:**
- `client/src/hooks/deployment/useDeploymentLogStream.ts` - WebSocket hook
- `client/src/components/dashboard/application/tabs/deployment-log-dialog.tsx` - Log viewer dialog

**Modify:**
- `client/src/components/dashboard/application/tabs/deployments-tab.tsx` - Use new log dialog

---

## Feature 2: Build Type Display

### Backend Schema
`serverlessbase/packages/server/src/db/schema/application.ts` lines 61-68:

```typescript
export const buildType = pgEnum("buildType", [
  "dockerfile",
  "heroku_buildpacks",
  "paketo_buildpacks",
  "nixpacks",
  "static",
  "railpack",
]);
```

### Main App Display
`serverlessbase/apps/serverlessbase/components/dashboard/application/build/show.tsx`:

```typescript
export enum BuildType {
  dockerfile = "Dockerfile",
  heroku_buildpacks = "Heroku Buildpacks",
  paketo_buildpacks = "Paketo Buildpacks",
  nixpacks = "Nixpacks",
  static = "Static",
  railpack = "Railpack",
}
```

### Implementation
Add build type to deployment display in client.

**Modify:**
- `client/src/types/deployment.ts` - Add BuildType enum matching backend
- `client/src/components/dashboard/application/tabs/deployments-tab.tsx` - Display build type

---

## Feature 3: Add "Command execution" Build Type (Backend + Client)

### Backend Changes
**File:** `serverlessbase/packages/server/src/db/schema/application.ts`

Add `"command"` to buildType enum:
```typescript
export const buildType = pgEnum("buildType", [
  "dockerfile",
  "heroku_buildpacks",
  "paketo_buildpacks",
  "nixpacks",
  "static",
  "railpack",
  "command",  // NEW - Command execution
]);
```

### Client Changes
**File:** `client/src/types/deployment.ts`

Add to BuildType enum:
```typescript
export const BuildType = {
  dockerfile: "Dockerfile",
  heroku_buildpacks: "Heroku Buildpacks",
  paketo_buildpacks: "Paketo Buildpacks",
  nixpacks: "Nixpacks",
  static: "Static",
  railpack: "Railpack",
  command: "Command Execution",  // NEW
} as const;
```

---

## Implementation Order

1. **Fix getLogs 404** - Update deploymentService.ts endpoint
2. **Add WebSocket log streaming** - Create hook and dialog component
3. **Add Build Type display** - Update types and UI
4. **Add "Command execution"** - Backend schema + Client types

---

## Files Summary

| File | Change |
|------|--------|
| `client/src/services/deployment/deploymentService.ts` | Fix getLogs method |
| `client/src/hooks/deployment/useDeploymentLogStream.ts` | NEW - WebSocket hook |
| `client/src/components/dashboard/application/tabs/deployment-log-dialog.tsx` | NEW - Log viewer |
| `client/src/components/dashboard/application/tabs/deployments-tab.tsx` | Use log dialog, show build type |
| `client/src/types/deployment.ts` | Add BuildType enum with "command" |
| `serverlessbase/packages/server/src/db/schema/application.ts` | Add "command" to buildType enum |
