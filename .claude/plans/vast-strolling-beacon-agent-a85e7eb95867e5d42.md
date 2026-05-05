# i18n Error Infrastructure & Prompt Framework Research - COMPREHENSIVE FINDINGS

## SEARCH COMPLETED ✓

This document contains thorough research on:
1. Backend i18n error infrastructure
2. Frontend error handling patterns
3. Test patterns and structure
4. Existing prompts folder naming conventions

---

## 1. BACKEND I18N ERROR INFRASTRUCTURE

### Error Helper Functions (27 total)

**Location**: `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/i18n/errors.ts`

#### Generic Error Helpers (Standard TRPC Errors)
- `unauthorizedError(t, resource?)` - Returns 401 UNAUTHORIZED with i18n message
- `notFoundError(t, resource, id?)` - Returns 404 NOT_FOUND with i18n message
- `forbiddenError(t, action?)` - Returns 403 FORBIDDEN with i18n message
- `badRequestError(t, messageKey, params?)` - Returns 400 BAD_REQUEST with i18n message
- `internalError(t, cause?)` - Returns 500 INTERNAL_SERVER_ERROR with i18n message

#### Service-Level Errors
- `createFailedError(t, service, details?)` - Service creation failed
- `updateFailedError(t, service, details?)` - Service update failed
- `deleteFailedError(t, service, details?)` - Service deletion failed
- `serviceStartFailedError(t, service, details?)` - Service start failed
- `serviceStopFailedError(t, service, details?)` - Service stop failed
- `serviceDeployFailedError(t, service, details?)` - Service deploy failed
- `serviceReloadFailedError(t, service, details?)` - Service reload failed
- `serviceRestartFailedError(t, service, details?)` - Service restart failed
- `serviceAccessDeniedError(t, service, resource)` - Service access denied

#### Permission Errors
- `permissionError(t, permissionKey)` - Permission check failed
- `serverRequiredError(t)` - Server required but missing

#### Subscription/Billing Errors
- `subscriptionNotFoundError(t, subscriptionId)` - Subscription not found
- `invalidTransitionError(t, currentStatus, targetStatus)` - Invalid state transition
- `noActiveTrialError(t)` - No active trial
- `trialExpiredError(t)` - Trial expired
- `pricingTierNotFoundError(t, tierId)` - Pricing tier missing
- `subscriptionAlreadyActiveError(t)` - Already has active subscription
- `noActiveSubscriptionError(t)` - No active subscription
- `upgradeTierMustBeHigherError(t)` - Upgrade to lower tier
- `downgradeTierMustBeLowerError(t)` - Downgrade to higher tier
- `noPausedSubscriptionError(t)` - No paused subscription to resume

#### Webhook/Message Helpers
- `webhookMessage(type, messageKey, params?)` - Webhook message template
- `gracePeriodMessage(event, params?)` - Grace period notification template
- `wrapError(t, error)` - Wrap existing error with i18n

### Error Locale Files Structure

**Location**: `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/i18n/locales/{lang}/`

Namespaces (each language has all of these):
- `en/errors.json` (165 lines, English reference)
- `ar/errors.json` (Arabic)
- `fr/errors.json` (French)
- `de/errors.json` (German)
- `es/errors.json` (Spanish)

**Error Categories in errors.json**:
```json
{
  "auth": {},              // Auth-related errors
  "features": {},          // Feature flag errors
  "user": {},              // User management errors
  "email": {},             // Email service errors
  "notification": {},      // Notification errors
  "organization": {},      // Organization access errors
  "resource": {},          // Generic resource errors (notFound, accessDenied, createFailed, etc.)
  "service": {},           // Service operation errors (startFailed, deployFailed, etc.)
  "operation": {},         // Generic operation errors (timeout, internalError, networkError)
  "project": {},           // Project-specific errors
  "deployment": {},        // Deployment errors
  "server": {},            // Server connection/management errors
  "firecrawl": {},         // Firecrawl API errors
  "wordpress": {},         // WordPress integration errors
  "subscription": {},      // Subscription/billing errors
  "webhook": {},           // Stripe webhook errors
  "webhookHandler": {},    // Webhook event handler errors
  "gracePeriod": {}        // Grace period notification messages
}
```

**Example Error Keys**:
- `errors:resource.notFound` → "{{resource}} not found"
- `errors:resource.notFoundById` → "{{resource}} with ID {{id}} not found"
- `errors:auth.unauthorized` → "You must be logged in to perform this action"
- `errors:service.deployFailed` → "Failed to deploy {{service}}"

### tRPC Context Setup

**Location**: `/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/server/api/trpc.ts`

Context structure includes:
```typescript
interface CreateContextOptions {
  user: (User & { role: "member" | "admin" | "owner"; ownerId: string }) | null;
  session: (Session & { activeOrganizationId: string; impersonatedBy?: string }) | null;
  req: CreateNextContextOptions["req"];
  res: CreateNextContextOptions["res"];
  language: SupportedLanguage;  // 'en' | 'ar' | 'fr' | 'de' | 'es'
  t: TFunction;                  // i18next translator function
}
```

**Language Detection Priority** (lines 103-116):
1. User's stored `preferredLanguage` (highest)
2. `Accept-Language` HTTP header
3. Default to `en`

**Translator Binding** (line 119):
```typescript
const t = getTranslator(language);
```

### How Errors Use ctx.t

**Pattern in Routers** (from application.ts, compose.ts, etc.):
```typescript
throw unauthorizedError(ctx.t, "project");
throw notFoundError(ctx.t, "PostgreSQL database", input.postgresId);
throw forbiddenError(ctx.t, "delete this project");
throw badRequestError(ctx.t, 'validation:password.tooWeak');
```

The `ctx.t` function is automatically bound to the detected language for that request.

---

## 2. FRONTEND ERROR HANDLING PATTERNS

### Error Type Definitions

**Location**: `/home/serverlessbase/serverless-v2/client/src/lib/api/types.ts`

```typescript
interface ApiErrorResponse {
  error: {
    message: string;        // Already translated from backend
    code: string;           // tRPC code: NOT_FOUND, UNAUTHORIZED, etc.
    data?: {
      code: string;
      path?: string;
      httpStatus?: number;
      zodError?: {
        fieldErrors: Record<string, string[]>;
        formErrors: string[];
      };
    };
  };
}

class ApiError extends Error {
  constructor(
    public message: string,           // Already translated
    public readonly code: string,
    public readonly statusCode: number,
    public readonly data?: unknown
  )
  
  // Methods:
  // - hasFieldErrors()
  // - getFieldErrors()
  // - getFormErrors()
  // - isValidationError()
  // - isRetryable()
  // - toJSON()
}

// Type guards
function isApiError(error: unknown): error is ApiError
function isApiErrorLike(error: unknown): error is {code, message, statusCode, data}
function toApiError(error: unknown): ApiError
```

### Error Code Constants

**Defined in types.ts**:
- `AUTH_ERROR_CODES` - UNAUTHORIZED, SESSION_EXPIRED
- `PERMISSION_ERROR_CODES` - FORBIDDEN, ACCESS_DENIED
- `CLIENT_ERROR_CODES` - BAD_REQUEST, NOT_FOUND, CONFLICT, VALIDATION_ERROR
- `SERVER_ERROR_CODES` - INTERNAL_SERVER_ERROR, SERVICE_UNAVAILABLE, TIMEOUT, NETWORK_ERROR

### Frontend Locale Files

**Location**: `/home/serverlessbase/serverless-v2/client/public/locales/en/` (47 namespace files)

Key namespaces with error-related content:
- `errors.json` (146 lines) - Client-side error messages
- `auth.json` - Auth-related errors
- `validation.json` - Form validation errors
- `common.json` - Common/generic errors

**Frontend errors.json Structure**:
```json
{
  "common": {},           // Network, timeout, unauthorized, forbidden, notFound, serverError, maintenance
  "fallback": {},         // Fallback messages for all error types
  "auth": {},             // Auth-specific errors (invalidCredentials, passwordTooWeak, etc.)
  "video": {},            // Video upload/processing errors
  "transcript": {},       // Transcript generation errors
  "folder": {},           // Folder operation errors
  "storage": {},          // Storage/quota errors
  "usage": {},            // Rate limit/usage limit errors
  "api": {},              // API-specific errors
  "validation": {},       // Form validation errors
  "pages": {              // Page-level error screens
    "generalError": {},   // 500 error page
    "notFound": {},       // 404 error page
    "unauthorized": {}    // 403 error page
  }
}
```

### tRPC Client Setup

**Location**: `/home/serverlessbase/serverless-v2/client/src/lib/api/dokploy.ts`

- Uses `ApiClient` wrapper around fetch
- Pre-configured for tRPC HTTP protocol
- Session-based auth via cookies (better-auth)
- Supports API obfuscation (when `VITE_OBFUSCATE_API=true`)

**Key:** Backend error messages are ALREADY TRANSLATED. Frontend receives translated message in `error.message`. Frontend should display directly without re-translating.

---

## 3. TEST PATTERNS & STRUCTURE

### Test Context Setup

**Location**: `/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/server/api/__tests__/helpers/context.ts`

Test helpers provide:
```typescript
interface TestContextOptions {
  userId?: string;           // default: 'test-user-id'
  email?: string;            // default: 'test@example.com'
  role?: 'owner' | 'admin' | 'member';  // default: 'member'
  ownerId?: string;          // default: 'test-owner-id'
  organizationId?: string;   // default: 'test-org-id'
  language?: SupportedLanguage;  // default: 'en'
}

// Helper function
export async function initTestI18n(): Promise<void>
```

### i18n Test Fixtures

**Location**: `/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/server/api/__tests__/fixtures/i18n-test-utils.ts`

Provides utilities for testing i18n in different languages.

---

## 4. PROMPTS FOLDER STRUCTURE & NAMING CONVENTIONS

### Folder Organization

**Location**: `/home/serverlessbase/serverless-v2/prompts/`

**Folder Categories** (with naming pattern):

| Category | Status Suffix | Examples |
|----------|---|---|
| Complete documentation | `_done/` | `docs-complete_done/`, `backend-i18n_done/` |
| AI Chatbot prompts | `mcp-chatbot/` | `01-mcp-schema.md`, `73-test-landing-page.md` |
| Feature development | (no suffix) | `app-studio-enhancements/`, `blog-system/`, `community-system/` |
| Reviews/Analysis | `_review/` | `docs-review/` |
| Subdirectories | `(nested)` | Some with "_done" suffix, some without |

### Naming Convention Pattern

**Format**: `{priority_number}-{descriptive-name}{status_suffix}.md`

Examples:
- `00-docs-infrastructure_done.md` - Priority 00, complete
- `01-mcp-schema.md` - Priority 01, ongoing
- `73-test-landing-page.md` - Priority 73, in mcp-chatbot folder
- `26-superadmin-overview-update.md` - Priority 26, ongoing

**Priority Numbers**:
- `00-09` - Foundation/infrastructure tasks
- `10-19` - Core features
- `20-29` - Admin/superadmin features
- `30-39` - Integration features
- `40-49` - Setup/configuration
- `50-59` - Deployment/deployment-related
- `60-79` - Testing/translation tasks
- `80+` - Misc/catch-all

### Prompt File Internal Structure

**From sample**: `/home/serverlessbase/serverless-v2/prompts/docs-complete_done/00-docs-infrastructure_done.md`

Header Format:
```markdown
# {Descriptive Title}

## Page Information

| Property | Value |
|----------|-------|
| **Source** | N/A (New implementation) |
| **Target Route** | `/docs/*` |
| **Purpose** | Description of what this accomplishes |
| **Priority** | Critical / High / Medium / Low |
| **Agents** | Comma-separated list of agent types |
| **Skills** | Comma-separated list of skill references |

---

## CRITICAL CONTEXT

> **Context reminder** - Key points that override defaults

---

## Overview

Description of the work...

### Key Differences / Context Table

| Aspect | Comparison |
|--------|-----------|
| Item1 | Description |
| Item2 | Description |

---

## Requirements

### 1. Task Name

- [ ] Subtask 1
- [ ] Subtask 2
- [ ] Subtask 3

\`\`\`bash
# Example commands
\`\`\`

[More sections as needed: Architecture, Implementation Details, Testing, etc.]
```

### Folder Examples

**`docs-complete_done/`** (20 files):
- `00-docs-infrastructure_done.md` - Fumadocs setup
- `01-docs-layout_done.md` - Layout structure
- `02-docs-navigation_done.md` - Navigation UI
- `05-user-getting-started_done.md` - User docs
- `07-user-applications_done.md` - Applications guide
- etc.

**`mcp-chatbot/`** (73+ files):
- `01-mcp-schema.md` - Schema design
- `10-mcp-project-tools.md` - Project tools
- `26-superadmin-overview-update.md` - Superadmin updates
- `40-dify-docker-setup.md` - Dify integration
- `72-test-superadmin.md` - Testing
- `73-test-landing-page.md` - Testing

**`backend-i18n_done/`** (7 files):
- Backend i18n infrastructure (completed)

**Other Active Folders**:
- `app-studio-enhancements_done/`
- `app-studio-restructure_done/`
- `blog-system GLM/` (with space in name - unusual)
- `blog-system/`
- `community-system/`
- `dashboard-home_done/`
- `dyad-app-studio_done/`

---

## KEY INSIGHTS FOR IMPLEMENTATION

### 1. Error Flow (Backend → Frontend)

1. **Backend**: tRPC procedure gets `ctx.t` translator bound to request language
2. **Backend**: Error helpers use `ctx.t` to translate error message BEFORE throwing
3. **Backend**: tRPC returns error with already-translated message
4. **Frontend**: `ApiError` class receives translated message
5. **Frontend**: App displays message directly (NO re-translation needed)

### 2. Locale File Organization

- **Backend**: `/serverlessbase/packages/server/src/i18n/locales/{lang}/` (Namespaced)
  - Multiple files: errors.json, validation.json, services.json, permissions.json, emails.json
  - Generated TypeScript types in `types.generated.ts`
  
- **Frontend**: `/client/public/locales/{lang}/` (Flat namespace files)
  - 47 separate JSON files (one per feature/section)
  - Loaded via i18n init

### 3. Testing i18n

- Context helpers accept `language` option
- Initialize i18n before tests with `initTestI18n()`
- Create test contexts with specific languages
- Verify error messages are translated correctly

### 4. New Prompt File Checklist

When creating prompt files:
- ✓ Use `{priority_number}-{name}.md` format
- ✓ Add status suffix if complete (`_done`)
- ✓ Include "Page Information" table with Agents & Skills
- ✓ Add "CRITICAL CONTEXT" section with ServerlessBase rules
- ✓ Structure with clear sections (Overview, Requirements, Implementation)
- ✓ Use checklist format for task breakdowns
- ✓ Reference CLAUDE.md rules where relevant
- ✓ Place in appropriate folder (`docs-complete_done/`, `mcp-chatbot/`, etc.)

---

## FILE REFERENCE SUMMARY

### Backend i18n (27 error helpers)
- Errors: `/serverlessbase/packages/server/src/i18n/errors.ts`
- Locales: `/serverlessbase/packages/server/src/i18n/locales/{en,ar,fr,de,es}/`
- Context: `/serverlessbase/apps/serverlessbase/server/api/trpc.ts` (lines 44-152)

### Frontend Error Handling
- Types: `/client/src/lib/api/types.ts`
- API Client: `/client/src/lib/api/dokploy.ts`
- Locales: `/client/public/locales/{en,ar,fr,de,es}/errors.json` (+ 46 other namespaces)

### Testing
- Context helpers: `/serverlessbase/apps/serverlessbase/server/api/__tests__/helpers/context.ts`
- i18n fixtures: `/serverlessbase/apps/serverlessbase/server/api/__tests__/fixtures/i18n-test-utils.ts`

### Prompts Examples
- Completed docs: `/prompts/docs-complete_done/` (20 files)
- Active prompts: `/prompts/mcp-chatbot/` (73+ files)
- Sample: `/prompts/docs-complete_done/00-docs-infrastructure_done.md`

---

## READY FOR IMPLEMENTATION

All research completed. System is ready to:
1. Create new prompt files following established patterns
2. Implement new error helpers with i18n support
3. Add new error translations to all 5 languages
4. Write tests with language-specific contexts

