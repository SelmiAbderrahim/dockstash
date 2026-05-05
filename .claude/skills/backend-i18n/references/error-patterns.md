# Error Patterns Reference

Comprehensive reference for error handling patterns in ServerlessBase backend i18n.

## Error Helper Function Signatures

### Generic Errors

```typescript
/**
 * Create an unauthorized error.
 * Use when user is not logged in or session expired.
 */
function unauthorizedError(t: TFunction, resource?: string): TRPCError;
// Examples:
throw unauthorizedError(ctx.t);
// Message: "You must be logged in to perform this action"

throw unauthorizedError(ctx.t, 'PostgreSQL database');
// Message: "You are not authorized to access this PostgreSQL database"
```

```typescript
/**
 * Create a not found error.
 * Use when a resource doesn't exist.
 */
function notFoundError(t: TFunction, resource: string, id?: string): TRPCError;
// Examples:
throw notFoundError(ctx.t, 'project');
// Message: "project not found"

throw notFoundError(ctx.t, 'PostgreSQL database', 'abc123');
// Message: "PostgreSQL database with ID abc123 not found"
```

```typescript
/**
 * Create a forbidden error.
 * Use when user lacks permission for an action.
 */
function forbiddenError(t: TFunction, action?: string): TRPCError;
// Examples:
throw forbiddenError(ctx.t);
// Message: "You don't have permission to access this resource"

throw forbiddenError(ctx.t, 'delete this project');
// Message: "You don't have permission to delete this project"
```

```typescript
/**
 * Create a bad request error with custom message key.
 * Use for validation or input errors.
 */
function badRequestError(
  t: TFunction,
  messageKey: string,
  params?: Record<string, string | number>
): TRPCError;
// Example:
throw badRequestError(ctx.t, 'validation:password.tooWeak');
```

```typescript
/**
 * Create an internal server error.
 * Use for unexpected errors.
 */
function internalError(t: TFunction, cause?: unknown): TRPCError;
// Example:
throw internalError(ctx.t, originalError);
```

### Resource Operation Errors

```typescript
/**
 * Create an error for failed resource creation.
 */
function createFailedError(t: TFunction, resource: string, cause?: unknown): TRPCError;
// Example:
throw createFailedError(ctx.t, 'application', error);
// Message: "Failed to create application"
```

```typescript
/**
 * Create an error for failed resource update.
 */
function updateFailedError(t: TFunction, resource: string, cause?: unknown): TRPCError;
// Example:
throw updateFailedError(ctx.t, 'environment variables', error);
// Message: "Failed to update environment variables"
```

```typescript
/**
 * Create an error for failed resource deletion.
 */
function deleteFailedError(t: TFunction, resource: string, cause?: unknown): TRPCError;
// Example:
throw deleteFailedError(ctx.t, 'backup', error);
// Message: "Failed to delete backup"
```

### Service-Specific Errors

Service names type: `'postgres' | 'mysql' | 'mariadb' | 'mongo' | 'redis' | 'application' | 'compose' | 'domain' | 'traefik' | 'nginx' | 'swarm'`

```typescript
/**
 * Create an error for failed service start.
 */
function serviceStartFailedError(t: TFunction, service: ServiceName, cause?: unknown): TRPCError;
// Example:
throw serviceStartFailedError(ctx.t, 'postgres', error);
// Message: "Failed to start PostgreSQL database"
```

```typescript
/**
 * Create an error for failed service stop.
 */
function serviceStopFailedError(t: TFunction, service: ServiceName, cause?: unknown): TRPCError;
// Example:
throw serviceStopFailedError(ctx.t, 'redis', error);
// Message: "Failed to stop Redis database"
```

```typescript
/**
 * Create an error for failed service deployment.
 */
function serviceDeployFailedError(t: TFunction, service: ServiceName, cause?: unknown): TRPCError;
// Example:
throw serviceDeployFailedError(ctx.t, 'application', error);
// Message: "Failed to deploy application"
```

```typescript
/**
 * Create an error for failed service reload.
 */
function serviceReloadFailedError(t: TFunction, service: ServiceName, cause?: unknown): TRPCError;
// Example:
throw serviceReloadFailedError(ctx.t, 'nginx', error);
// Message: "Failed to reload Nginx proxy"
```

```typescript
/**
 * Create an error for failed service restart.
 */
function serviceRestartFailedError(t: TFunction, service: ServiceName, cause?: unknown): TRPCError;
// Example:
throw serviceRestartFailedError(ctx.t, 'postgres', error);
// Message: "Failed to restart PostgreSQL database"
```

```typescript
/**
 * Create an error for service access denial.
 * Actions: 'access' | 'start' | 'stop' | 'deploy' | 'delete' | 'modify'
 */
function serviceAccessDeniedError(
  t: TFunction,
  service: ServiceName,
  action: 'access' | 'start' | 'stop' | 'deploy' | 'delete' | 'modify'
): TRPCError;
// Example:
throw serviceAccessDeniedError(ctx.t, 'postgres', 'delete');
// Message: "You cannot delete PostgreSQL database"
```

### Permission-Specific Errors

```typescript
/**
 * Create an error for permission issues.
 * Uses keys from permissions namespace.
 */
function permissionError(t: TFunction, permissionKey: string): TRPCError;
// Example:
throw permissionError(ctx.t, 'user.cannotDeleteOwner');
// Message: "Cannot delete the organization owner"
```

```typescript
/**
 * Create an error when server is required but not configured.
 */
function serverRequiredError(t: TFunction): TRPCError;
// Example:
throw serverRequiredError(ctx.t);
// Message: "A server must be configured for this operation"
```

### Utility Functions

```typescript
/**
 * Wrap an error in a TRPCError with translated message.
 * Useful for catching and re-throwing with proper i18n.
 */
function wrapError(
  t: TFunction,
  error: unknown,
  messageKey: string,
  params?: Record<string, string | number>
): TRPCError;
// Example:
try {
  await someOperation();
} catch (error) {
  throw wrapError(ctx.t, error, 'errors:operation.internalError');
}
```

## Error Code Mapping

| Helper Function | tRPC Code | HTTP Status |
|-----------------|-----------|-------------|
| `unauthorizedError` | UNAUTHORIZED | 401 |
| `notFoundError` | NOT_FOUND | 404 |
| `forbiddenError` | FORBIDDEN | 403 |
| `badRequestError` | BAD_REQUEST | 400 |
| `internalError` | INTERNAL_SERVER_ERROR | 500 |
| `createFailedError` | BAD_REQUEST | 400 |
| `updateFailedError` | BAD_REQUEST | 400 |
| `deleteFailedError` | BAD_REQUEST | 400 |
| `serviceStartFailedError` | BAD_REQUEST | 400 |
| `serviceStopFailedError` | BAD_REQUEST | 400 |
| `serviceDeployFailedError` | BAD_REQUEST | 400 |
| `serviceReloadFailedError` | BAD_REQUEST | 400 |
| `serviceRestartFailedError` | BAD_REQUEST | 400 |
| `serviceAccessDeniedError` | UNAUTHORIZED | 401 |
| `permissionError` | FORBIDDEN | 403 |
| `serverRequiredError` | BAD_REQUEST | 400 |

## Translation Keys Reference

### errors.json

```json
{
  "auth": {
    "unauthorized": "You must be logged in to perform this action",
    "forbidden": "You don't have permission to access this resource",
    "adminRequired": "Admin access required",
    "sessionExpired": "Your session has expired. Please sign in again",
    "invalidCredentials": "Invalid email or password"
  },
  "resource": {
    "notFound": "{{resource}} not found",
    "notFoundById": "{{resource}} with ID {{id}} not found",
    "accessDenied": "You are not authorized to access this {{resource}}",
    "createFailed": "Failed to create {{resource}}",
    "updateFailed": "Failed to update {{resource}}",
    "deleteFailed": "Failed to delete {{resource}}",
    "alreadyExists": "{{resource}} already exists",
    "inUse": "{{resource}} is in use and cannot be deleted"
  },
  "service": {
    "startFailed": "Failed to start {{service}}",
    "stopFailed": "Failed to stop {{service}}",
    "deployFailed": "Failed to deploy {{service}}",
    "reloadFailed": "Failed to reload {{service}}",
    "restartFailed": "Failed to restart {{service}}",
    "notRunning": "{{service}} is not running",
    "alreadyRunning": "{{service}} is already running"
  },
  "operation": {
    "timeout": "Operation timed out",
    "internalError": "An internal error occurred",
    "databaseError": "A database error occurred",
    "networkError": "A network error occurred"
  }
}
```

### permissions.json

```json
{
  "generic": {
    "actionNotAllowed": "You don't have permission to {{action}}"
  },
  "user": {
    "cannotDeleteOwner": "Cannot delete the organization owner",
    "cannotDeleteSelf": "You cannot delete your own account",
    "cannotChangeOwnRole": "You cannot change your own role"
  },
  "organization": {
    "notMember": "You are not a member of this organization",
    "onlyOwnersAdmins": "Only owners and admins can perform this action"
  },
  "service": {
    "cannotAccess": "You cannot access {{service}}",
    "cannotStart": "You cannot start {{service}}",
    "cannotStop": "You cannot stop {{service}}",
    "cannotDeploy": "You cannot deploy {{service}}",
    "cannotDelete": "You cannot delete {{service}}",
    "cannotModify": "You cannot modify {{service}}",
    "requiresServer": "A server must be configured for this operation"
  }
}
```

## Router Implementation Examples

### Before (Hardcoded Strings)

```typescript
// DON'T DO THIS
if (!postgres) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'PostgreSQL database not found',
  });
}

if (!ctx.user) {
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'You must be logged in',
  });
}

try {
  await startPostgres(postgres);
} catch (error) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Failed to start PostgreSQL',
  });
}
```

### After (Internationalized)

```typescript
// DO THIS
if (!postgres) {
  throw notFoundError(ctx.t, 'PostgreSQL database', input.postgresId);
}

if (!ctx.user) {
  throw unauthorizedError(ctx.t);
}

try {
  await startPostgres(postgres);
} catch (error) {
  throw serviceStartFailedError(ctx.t, 'postgres', error);
}
```

## Best Practices

1. **Always use error helpers** when available instead of creating TRPCError directly
2. **Preserve the original error** by passing it as the `cause` parameter
3. **Use interpolation** for dynamic values (resource names, IDs)
4. **Test with multiple languages** to ensure translations work
5. **Keep error messages user-friendly** - don't expose technical details
6. **Log the original error** for debugging before throwing translated error
