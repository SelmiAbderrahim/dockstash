---
name: backend-i18n
description: >
  Comprehensive guide for implementing backend internationalization in ServerlessBase.
  Use when working on tRPC error messages, Zod validation, email templates, or translation management.
---

# Backend i18n Skill

Comprehensive guide for implementing backend internationalization in ServerlessBase. Use this skill when working on tRPC error messages, Zod validation, email templates, or translation management.

## When to Use

- Adding new translated error messages to tRPC routers
- Creating localized Zod validation schemas
- Implementing email template translations
- Managing translation files across languages
- Testing i18n functionality
- Integrating language detection in API endpoints

## Quick Reference

### Add New Error Message

1. Add key to English translations:
   ```json
   // serverlessbase/packages/server/src/i18n/locales/en/errors.json
   {
     "myCategory": {
       "newError": "Error message with {{variable}}"
     }
   }
   ```

2. Add to all other languages (ar, fr, de, es)

3. Use in router with error helper or direct translation:
   ```typescript
   // Using error helper (preferred)
   throw notFoundError(ctx.t, 'project', projectId);

   // Using direct translation
   throw new TRPCError({
     code: 'BAD_REQUEST',
     message: ctx.t('errors:myCategory.newError', { variable: value }),
   });
   ```

### Add New Validation Message

1. Add key to English validation:
   ```json
   // serverlessbase/packages/server/src/i18n/locales/en/validation.json
   {
     "myField": {
       "invalid": "Invalid {{field}} format"
     }
   }
   ```

2. Add to all other languages

3. Use in Zod schema with custom refinement:
   ```typescript
   z.string().refine(
     (val) => isValid(val),
     {
       message: ctx.t('validation:myField.invalid', { field: 'value' }),
       // Or use i18nKey for automatic translation via error map
       params: { i18nKey: 'validation:myField.invalid', i18nParams: { field: 'value' } }
     }
   );
   ```

### Add New Email Template String

1. Add to English emails:
   ```json
   // serverlessbase/packages/server/src/i18n/locales/en/emails.json
   {
     "myEmail": {
       "subject": "Email Subject",
       "greeting": "Hello {{name}}",
       "body": "Email body content"
     }
   }
   ```

2. Add to all other languages

3. Use in email service:
   ```typescript
   const t = getNamespacedTranslator(userLanguage, 'emails');
   await sendEmail({
     to: email,
     subject: t('myEmail.subject'),
     body: t('myEmail.greeting', { name: userName }),
   });
   ```

## Architecture

```
Client Request
    |
    +-- Accept-Language: ar
    |
    v
tRPC Context Middleware
    |
    +-- parseAcceptLanguage() -> "ar"
    +-- getTranslator("ar") -> TFunction
    |
    v
Context { language: "ar", t: TFunction }
    |
    v
Router Procedure
    |
    +-- Use ctx.t() for messages
    +-- Use error helpers for common patterns
    |
    v
Translated Response
```

## File Locations

| Component | Path |
|-----------|------|
| i18n Index | `serverlessbase/packages/server/src/i18n/index.ts` |
| Error Helpers | `serverlessbase/packages/server/src/i18n/errors.ts` |
| Zod Error Map | `serverlessbase/packages/server/src/i18n/zod-error-map.ts` |
| Language Detection | `serverlessbase/packages/server/src/i18n/language-detection.ts` |
| Type Definitions | `serverlessbase/packages/server/src/i18n/types.ts` |
| Generated Types | `serverlessbase/packages/server/src/i18n/types.generated.ts` |
| Typed Translator | `serverlessbase/packages/server/src/i18n/typed-translator.ts` |
| English Translations | `serverlessbase/packages/server/src/i18n/locales/en/` |
| Arabic Translations | `serverlessbase/packages/server/src/i18n/locales/ar/` |
| French Translations | `serverlessbase/packages/server/src/i18n/locales/fr/` |
| German Translations | `serverlessbase/packages/server/src/i18n/locales/de/` |
| Spanish Translations | `serverlessbase/packages/server/src/i18n/locales/es/` |
| Unit Tests | `serverlessbase/packages/server/src/i18n/__tests__/` |
| Type Generator | `serverlessbase/packages/server/src/i18n/scripts/generate-types.ts` |

## Supported Languages

| Code | Language | Direction | Notes |
|------|----------|-----------|-------|
| en | English | LTR | Reference language (always complete) |
| ar | Arabic | RTL | Requires RTL consideration for UI |
| fr | French | LTR | |
| de | German | LTR | |
| es | Spanish | LTR | |

## Namespaces

| Namespace | Purpose | Example Key |
|-----------|---------|-------------|
| errors | TRPCError messages | `errors:resource.notFound` |
| validation | Zod validation messages | `validation:string.required` |
| permissions | Access control messages | `permissions:user.cannotDeleteOwner` |
| services | Service-specific messages | `services:postgres.name` |
| emails | Email template strings | `emails:invitation.subject` |

## Error Helper Functions

Import from `@dokploy/server` or the i18n module:

```typescript
import {
  // Generic errors
  unauthorizedError,     // UNAUTHORIZED - login required
  notFoundError,        // NOT_FOUND - resource not found
  forbiddenError,       // FORBIDDEN - permission denied
  badRequestError,      // BAD_REQUEST - invalid input
  internalError,        // INTERNAL_SERVER_ERROR - unexpected error

  // Resource operation errors
  createFailedError,    // BAD_REQUEST - creation failed
  updateFailedError,    // BAD_REQUEST - update failed
  deleteFailedError,    // BAD_REQUEST - deletion failed

  // Service errors (postgres, mysql, redis, etc.)
  serviceStartFailedError,
  serviceStopFailedError,
  serviceDeployFailedError,
  serviceReloadFailedError,
  serviceRestartFailedError,
  serviceAccessDeniedError,

  // Permission errors
  permissionError,      // FORBIDDEN - specific permission
  serverRequiredError,  // BAD_REQUEST - server not configured

  // Utility
  wrapError,           // Wrap any error with translation
} from '@dokploy/server/i18n';
```

### Usage Examples

```typescript
// Not found with ID
throw notFoundError(ctx.t, 'PostgreSQL database', postgresId);
// Message (en): "PostgreSQL database with ID abc123 not found"
// Message (ar): "قاعدة بيانات PostgreSQL بالمعرف abc123 غير موجودة"

// Not found without ID
throw notFoundError(ctx.t, 'project');
// Message (en): "project not found"

// Unauthorized
throw unauthorizedError(ctx.t);
// Message (en): "You must be logged in to perform this action"

// Forbidden with action
throw forbiddenError(ctx.t, 'delete this project');
// Message (en): "You don't have permission to delete this project"

// Service operation failed
throw serviceStartFailedError(ctx.t, 'postgres', originalError);
// Message (en): "Failed to start PostgreSQL database"

// Permission denied
throw permissionError(ctx.t, 'user.cannotDeleteOwner');
// Message (en): "Cannot delete the organization owner"

// Wrap existing error
throw wrapError(ctx.t, error, 'errors:operation.internalError');
```

## Zod Integration

### Using the Error Map

```typescript
import { createZodErrorMap, validateWithLocalizedErrors } from '@dokploy/server/i18n';

// Option 1: Validate with localized errors directly
const result = validateWithLocalizedErrors(mySchema, input, ctx.t);
if (!result.success) {
  // result.error.issues have translated messages
}

// Option 2: Apply globally for current request
applyLocalizedZodErrorMap(ctx.t);
const validated = mySchema.parse(input); // Errors are translated
```

### Custom Validation Messages

```typescript
const schema = z.object({
  name: z.string()
    .min(1, ctx.t('validation:string.required'))
    .max(100, ctx.t('validation:string.maxLength', { max: 100 })),

  email: z.string()
    .email(ctx.t('validation:string.email')),

  // Custom refinement with i18n key (preferred)
  domain: z.string().refine(
    (val) => isValidDomain(val),
    { params: { i18nKey: 'validation:custom.domain.invalidFormat' } }
  ),
});
```

## Testing Commands

All commands run inside Docker containers:

```bash
# Run all i18n tests
docker exec -it serverless-main-app pnpm test packages/server/src/i18n

# Run specific test file
docker exec -it serverless-main-app pnpm test packages/server/src/i18n/__tests__/errors.test.ts

# Run translation completeness check
docker exec -it serverless-main-app pnpm test packages/server/src/i18n/__tests__/translation-completeness.test.ts

# Generate TypeScript types from translations
docker exec -it serverless-main-app npx ts-node packages/server/src/i18n/scripts/generate-types.ts

# Run with watch mode during development
docker exec -it serverless-main-app pnpm test --watch packages/server/src/i18n
```

## Common Patterns

### Resource CRUD Operations

```typescript
// Find or throw
const postgres = await findPostgresById(db, postgresId);
if (!postgres) {
  throw notFoundError(ctx.t, 'PostgreSQL database', postgresId);
}

// Create with error handling
try {
  return await createPostgres(db, input);
} catch (error) {
  throw createFailedError(ctx.t, 'PostgreSQL database', error);
}

// Update with error handling
try {
  return await updatePostgres(db, postgresId, input);
} catch (error) {
  throw updateFailedError(ctx.t, 'PostgreSQL database', error);
}

// Delete with error handling
try {
  return await deletePostgres(db, postgresId);
} catch (error) {
  throw deleteFailedError(ctx.t, 'PostgreSQL database', error);
}
```

### Permission Checks

```typescript
// Check admin access
if (!ctx.user.isAdmin) {
  throw forbiddenError(ctx.t, 'manage users');
}

// Check specific permission
if (targetUser.role === 'owner') {
  throw permissionError(ctx.t, 'user.cannotDeleteOwner');
}

// Check organization membership
if (!ctx.user.organizationId) {
  throw permissionError(ctx.t, 'organization.notMember');
}
```

### Service Operations

```typescript
// Start service
try {
  await startPostgresService(postgres);
} catch (error) {
  throw serviceStartFailedError(ctx.t, 'postgres', error);
}

// Stop service
try {
  await stopPostgresService(postgres);
} catch (error) {
  throw serviceStopFailedError(ctx.t, 'postgres', error);
}

// Deploy service
try {
  await deployApplication(application);
} catch (error) {
  throw serviceDeployFailedError(ctx.t, 'application', error);
}
```

## Checklist for New Features

- [ ] Identify all user-facing error messages
- [ ] Add keys to English translations (errors.json, validation.json, etc.)
- [ ] Add translations to all 5 languages (en, ar, fr, de, es)
- [ ] Use error helper functions where applicable
- [ ] Use Zod error map for validation messages
- [ ] Add unit tests for translated messages
- [ ] Run translation completeness test
- [ ] Verify interpolation variables match across languages
- [ ] Test with Arabic locale for RTL considerations

## Adding a New Language

1. Create new locale directory: `locales/{code}/`
2. Copy all JSON files from `locales/en/`
3. Translate all strings
4. Add language code to `SUPPORTED_LANGUAGES` in `index.ts`
5. Update `types.ts` with new language type
6. Run translation completeness test
7. Update client-side language selector

## Troubleshooting

### Missing Translation Warning

```
[i18n] Missing translation: ar/errors/myCategory.newKey
```

**Solution**: Add the missing key to the Arabic translations file.

### Interpolation Not Working

```typescript
// Wrong: Missing interpolation value
ctx.t('errors:resource.notFound')  // "{{resource}} not found"

// Correct: Provide interpolation value
ctx.t('errors:resource.notFound', { resource: 'Project' })  // "Project not found"
```

### Type Error on Translation Key

**Solution**: Run the type generator to update types:
```bash
docker exec -it serverless-main-app npx ts-node packages/server/src/i18n/scripts/generate-types.ts
```

## References

- RTL support patterns: `.claude/rules/rtl-support-arabic.md`
- tRPC API patterns: `.claude/rules/trpc-api-patterns.md`
- Error patterns reference: `.claude/skills/backend-i18n/references/error-patterns.md`
- Translation structure reference: `.claude/skills/backend-i18n/references/translation-structure.md`
- Testing patterns reference: `.claude/skills/backend-i18n/references/testing-patterns.md`
