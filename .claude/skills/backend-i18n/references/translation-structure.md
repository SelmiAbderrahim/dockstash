# Translation Structure Reference

Complete reference for translation file organization and structure in ServerlessBase backend.

## Directory Layout

```
serverlessbase/packages/server/src/i18n/
├── index.ts                     # Main exports, i18n initialization
├── errors.ts                    # Error helper functions
├── zod-error-map.ts             # Zod localization utilities
├── language-detection.ts        # Accept-Language parsing
├── types.ts                     # Manual TypeScript types
├── types.generated.ts           # Auto-generated types from translations
├── typed-translator.ts          # Type-safe translator utilities
├── scripts/
│   └── generate-types.ts        # Type generation script
├── locales/
│   ├── en/
│   │   ├── errors.json          # Error messages
│   │   ├── validation.json      # Zod validation messages
│   │   ├── permissions.json     # Permission error messages
│   │   ├── services.json        # Service names and labels
│   │   └── emails.json          # Email template strings
│   ├── ar/                      # Arabic (same structure)
│   ├── fr/                      # French (same structure)
│   ├── de/                      # German (same structure)
│   └── es/                      # Spanish (same structure)
└── __tests__/
    ├── i18n.test.ts             # Core i18n tests
    ├── errors.test.ts           # Error helper tests
    ├── zod-error-map.test.ts    # Zod integration tests
    ├── language-detection.test.ts
    ├── language-detection.perf.test.ts
    ├── typed-translator.test.ts
    └── translation-completeness.test.ts
```

## Namespace Files

### errors.json

Error messages for TRPCError responses.

```json
{
  "auth": {
    "unauthorized": "You must be logged in to perform this action",
    "forbidden": "You don't have permission to access this resource",
    "adminRequired": "Admin access required",
    "superadminRequired": "Superadmin access required",
    "sessionExpired": "Your session has expired. Please sign in again",
    "invalidCredentials": "Invalid email or password",
    "accountDisabled": "Your account has been disabled",
    "emailNotVerified": "Please verify your email address",
    "twoFactorRequired": "Two-factor authentication is required",
    "twoFactorInvalid": "Invalid two-factor authentication code"
  },
  "features": {
    "notEnabled": "This feature requires \"{{feature}}\" to be enabled for your organization",
    "disabledOnCloud": "This feature is disabled on cloud"
  },
  "user": {
    "currentPasswordIncorrect": "Current password is incorrect",
    "newPasswordRequired": "New password is required",
    "updateFailed": "Failed to update user"
  },
  "email": {
    "invitationNotFound": "Invitation email not found",
    "providerNotEmail": "Selected notification provider is not an email type",
    "notConfigured": "No email provider selected and system email not configured",
    "sendFailed": "Failed to send email"
  },
  "notification": {
    "createFailed": "Error creating the notification",
    "updateFailed": "Error updating the notification",
    "testFailed": "Error testing the notification",
    "sendFailed": "Error sending the notification",
    "tokenNotFound": "Token not found"
  },
  "organization": {
    "notMember": "You are not a member of this organization",
    "userNotMember": "User is not a member of your active organization",
    "onlyOwnersAdmins": "Only owners and admins can perform this action"
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
    "networkError": "A network error occurred",
    "rateLimited": "Too many requests. Please try again later",
    "maintenanceMode": "System is under maintenance. Please try again later"
  },
  "project": {
    "notFound": "Project not found",
    "accessDenied": "You don't have access to this project",
    "createFailed": "Failed to create project",
    "updateFailed": "Failed to update project",
    "deleteFailed": "Failed to delete project"
  },
  "deployment": {
    "failed": "Deployment failed",
    "cancelled": "Deployment was cancelled",
    "buildFailed": "Build failed",
    "inProgress": "A deployment is already in progress"
  },
  "server": {
    "connectionFailed": "Failed to connect to server",
    "sshError": "SSH connection error",
    "unreachable": "Server is unreachable",
    "invalidCredentials": "Invalid server credentials",
    "quotaExceeded": "You cannot create more servers",
    "hasActiveServices": "Server has active services, please delete them first",
    "inactive": "Server is inactive",
    "certbotNotInstalled": "Certbot is not installed on this server"
  }
}
```

### validation.json

Zod validation error messages.

```json
{
  "type": {
    "invalid": "Expected {{expected}}, received {{received}}"
  },
  "string": {
    "required": "This field is required",
    "minLength": "Must be at least {{min}} characters",
    "maxLength": "Must be no more than {{max}} characters",
    "email": "Please enter a valid email address",
    "url": "Please enter a valid URL",
    "uuid": "Invalid ID format",
    "cuid": "Invalid CUID format",
    "cuid2": "Invalid CUID2 format",
    "ulid": "Invalid ULID format",
    "emoji": "Must be a valid emoji",
    "ip": "Please enter a valid IP address",
    "base64": "Must be valid base64 encoded",
    "pattern": "Invalid format",
    "alphanumeric": "Must contain only letters and numbers",
    "slug": "Must be a valid slug (lowercase letters, numbers, and hyphens)",
    "noWhitespace": "Cannot contain whitespace",
    "noLeadingTrailingSpaces": "Cannot have leading or trailing spaces",
    "includes": "Must include \"{{value}}\"",
    "startsWith": "Must start with \"{{value}}\"",
    "endsWith": "Must end with \"{{value}}\""
  },
  "number": {
    "required": "This field is required",
    "min": "Must be at least {{min}}",
    "max": "Must be no more than {{max}}",
    "minExclusive": "Must be greater than {{min}}",
    "maxExclusive": "Must be less than {{max}}",
    "positive": "Must be a positive number",
    "negative": "Must be a negative number",
    "integer": "Must be a whole number",
    "finite": "Must be a finite number",
    "multipleOf": "Must be a multiple of {{multipleOf}}",
    "port": "Must be a valid port number (1-65535)"
  },
  "array": {
    "required": "At least one item is required",
    "minLength": "Must have at least {{min}} items",
    "maxLength": "Must have no more than {{max}} items",
    "unique": "All items must be unique"
  },
  "set": {
    "minSize": "Must have at least {{min}} items",
    "maxSize": "Must have no more than {{max}} items"
  },
  "object": {
    "required": "This field is required",
    "unrecognizedKeys": "Unrecognized keys: {{keys}}"
  },
  "boolean": {
    "required": "This field is required"
  },
  "date": {
    "required": "This field is required",
    "invalid": "Invalid date",
    "future": "Date must be in the future",
    "past": "Date must be in the past",
    "min": "Date must be after {{min}}",
    "max": "Date must be before {{max}}"
  },
  "literal": {
    "invalid": "Must be exactly {{expected}}"
  },
  "enum": {
    "invalid": "Invalid option. Expected one of: {{options}}"
  },
  "union": {
    "invalid": "Invalid input",
    "invalidDiscriminator": "Invalid discriminator value. Expected one of: {{options}}"
  },
  "intersection": {
    "invalid": "Intersection type validation failed"
  },
  "function": {
    "invalidArguments": "Invalid function arguments",
    "invalidReturnType": "Invalid function return type"
  },
  "password": {
    "tooShort": "Password must be at least {{min}} characters",
    "tooWeak": "Password is too weak",
    "noUppercase": "Password must contain at least one uppercase letter",
    "noLowercase": "Password must contain at least one lowercase letter",
    "noNumber": "Password must contain at least one number",
    "noSpecial": "Password must contain at least one special character"
  },
  "domain": {
    "invalid": "Invalid domain format",
    "alreadyExists": "Domain is already in use"
  },
  "docker": {
    "invalidImage": "Invalid Docker image format",
    "invalidContainerName": "Invalid container name format"
  },
  "custom": {
    "sshKey": {
      "invalidPublicKey": "Invalid public key format. Supported formats: RSA, Ed25519, ECDSA",
      "invalidPrivateKey": "Invalid private key format"
    },
    "domain": {
      "invalidFormat": "Invalid domain format",
      "noProtocol": "Domain should not include protocol (http/https)",
      "noPath": "Domain should not include path",
      "noPort": "Domain should not include port",
      "noLeadingTrailingSpaces": "Domain cannot have leading or trailing spaces"
    },
    "port": {
      "min": "Port must be at least 1",
      "max": "Port must be 65535 or below",
      "reserved": "Port {{port}} is reserved"
    },
    "password": {
      "tooWeak": "Password is too weak",
      "minLength": "Password must be at least {{min}} characters",
      "requireUppercase": "Password must contain at least one uppercase letter",
      "requireLowercase": "Password must contain at least one lowercase letter",
      "requireNumber": "Password must contain at least one number",
      "requireSpecial": "Password must contain at least one special character"
    },
    "username": {
      "invalid": "Username can only contain letters, numbers, and underscores",
      "reserved": "This username is reserved"
    },
    "projectName": {
      "invalid": "Project name can only contain letters, numbers, hyphens, and underscores"
    },
    "environmentVariable": {
      "invalidKey": "Environment variable key is invalid",
      "reservedKey": "Environment variable key {{key}} is reserved"
    }
  }
}
```

### permissions.json

Permission-related error messages.

```json
{
  "generic": {
    "actionNotAllowed": "You don't have permission to {{action}}"
  },
  "user": {
    "cannotDeleteOwner": "Cannot delete the organization owner",
    "cannotDeleteSelf": "You cannot delete your own account",
    "cannotChangeOwnRole": "You cannot change your own role",
    "cannotInviteHigherRole": "You cannot invite users with a higher role than yours"
  },
  "organization": {
    "notMember": "You are not a member of this organization",
    "onlyOwners": "Only organization owners can perform this action",
    "onlyOwnersAdmins": "Only owners and admins can perform this action"
  },
  "project": {
    "cannotAccess": "You cannot access this project",
    "cannotDelete": "You cannot delete this project"
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

### services.json

Service names and labels for dynamic messages.

```json
{
  "project": {
    "name": "project",
    "description": "Project container"
  },
  "environment": {
    "name": "environment",
    "description": "Deployment environment"
  },
  "postgres": {
    "name": "PostgreSQL database",
    "description": "PostgreSQL relational database"
  },
  "mysql": {
    "name": "MySQL database",
    "description": "MySQL relational database"
  },
  "mariadb": {
    "name": "MariaDB database",
    "description": "MariaDB relational database"
  },
  "mongo": {
    "name": "MongoDB database",
    "description": "MongoDB document database"
  },
  "redis": {
    "name": "Redis database",
    "description": "Redis in-memory data store"
  },
  "application": {
    "name": "application",
    "description": "Web application"
  },
  "compose": {
    "name": "Docker Compose service",
    "description": "Multi-container Docker application"
  },
  "domain": {
    "name": "domain",
    "description": "Custom domain configuration"
  },
  "traefik": {
    "name": "Traefik proxy",
    "description": "Traefik reverse proxy and load balancer"
  },
  "nginx": {
    "name": "Nginx proxy",
    "description": "Nginx reverse proxy and web server"
  },
  "swarm": {
    "name": "Docker Swarm service",
    "description": "Docker Swarm orchestrated service"
  },
  "server": {
    "name": "server",
    "description": "Remote server for deployments"
  },
  "previewDeployment": {
    "name": "preview deployment",
    "description": "Preview deployment for testing"
  },
  "status": {
    "running": "Running",
    "stopped": "Stopped",
    "starting": "Starting",
    "stopping": "Stopping",
    "deploying": "Deploying",
    "error": "Error",
    "unknown": "Unknown"
  },
  "actions": {
    "start": "Start",
    "stop": "Stop",
    "restart": "Restart",
    "deploy": "Deploy",
    "redeploy": "Redeploy",
    "delete": "Delete"
  }
}
```

### emails.json

Email template strings.

```json
{
  "invitation": {
    "subject": "You've been invited to join {{organizationName}}",
    "greeting": "Hello,",
    "body": "{{inviterName}} has invited you to join {{organizationName}} on ServerlessBase.",
    "action": "Accept Invitation",
    "footer": "This invitation will expire in 7 days.",
    "ignore": "If you didn't expect this invitation, you can safely ignore this email."
  },
  "passwordReset": {
    "subject": "Reset your password",
    "greeting": "Hello {{name}},",
    "body": "We received a request to reset your password.",
    "action": "Reset Password",
    "footer": "This link will expire in 1 hour.",
    "ignore": "If you didn't request a password reset, you can safely ignore this email."
  },
  "emailVerification": {
    "subject": "Verify your email address",
    "greeting": "Hello {{name}},",
    "body": "Please verify your email address to complete your registration.",
    "action": "Verify Email",
    "footer": "This link will expire in 24 hours."
  },
  "deploymentNotification": {
    "success": {
      "subject": "Deployment successful: {{appName}}",
      "body": "Your deployment of {{appName}} completed successfully."
    },
    "failed": {
      "subject": "Deployment failed: {{appName}}",
      "body": "Your deployment of {{appName}} failed. Please check the logs for details."
    }
  },
  "common": {
    "regards": "Best regards,",
    "team": "The ServerlessBase Team",
    "copyright": "2024 ServerlessBase. All rights reserved.",
    "unsubscribe": "Unsubscribe from these emails"
  }
}
```

## Key Naming Conventions

1. **Use camelCase** for all keys
2. **Group related keys** in nested objects
3. **Use interpolation** for dynamic values: `{{variable}}`
4. **Keep keys descriptive** but concise
5. **Use consistent verbs**: `createFailed`, `updateFailed`, `deleteFailed`

### Examples

```
Good Keys:
- resource.notFound
- auth.invalidCredentials
- validation.string.minLength
- services.postgres.name

Bad Keys:
- error1
- not_found_resource
- STRING_MIN_LENGTH
- postgresServiceName
```

## Interpolation Patterns

### Simple Values

```json
{
  "greeting": "Hello {{name}}!"
}
```

```typescript
t('emails:greeting', { name: 'John' })
// Output: "Hello John!"
```

### Multiple Values

```json
{
  "range": "Must be between {{min}} and {{max}}"
}
```

```typescript
t('validation:range', { min: 1, max: 100 })
// Output: "Must be between 1 and 100"
```

### Nested Keys

```json
{
  "resource": {
    "notFoundById": "{{resource}} with ID {{id}} not found"
  }
}
```

```typescript
t('errors:resource.notFoundById', { resource: 'Project', id: 'abc123' })
// Output: "Project with ID abc123 not found"
```

## Adding New Translations

### Step 1: Add to English First

Always add new keys to the English file first as it's the reference language.

### Step 2: Copy to Other Languages

Copy the new keys to all other language files and translate them.

### Step 3: Verify Interpolation

Ensure all interpolation variables are present in all languages.

### Step 4: Run Completeness Test

```bash
docker exec -it serverless-main-app pnpm test packages/server/src/i18n/__tests__/translation-completeness.test.ts
```

## Type Generation

Run the type generator after adding new keys:

```bash
docker exec -it serverless-main-app npx ts-node packages/server/src/i18n/scripts/generate-types.ts
```

This creates `types.generated.ts` with type definitions for all translation keys.
