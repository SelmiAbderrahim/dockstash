---
name: stalwart-testing
description: >
  Testing strategy and infrastructure for Stalwart Mail Server integration on
  ServerlessBase. Covers MSW mock server, backend unit tests, frontend component
  tests, i18n completeness, E2E tests, and performance benchmarks.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "testing"
  dependencies: "vitest, msw, @testing-library/react, playwright"
  project: "ServerlessBase - Stalwart Testing"
---

# Stalwart Testing Guide

## Overview

Testing strategy and patterns for Stalwart Mail Server integration on ServerlessBase. Covers provisioning, health checks, DAV operations, and frontend component tests.

## Test Patterns for Provisioning

### Unit tests for initStalwartProvisioning

```typescript
describe('initStalwartProvisioning', () => {
  it('should be idempotent — running twice creates no duplicates', async () => {
    await initStalwartProvisioning();
    const countBefore = await db.select().from(mailSyncLog).where(eq(mailSyncLog.operation, 'provision'));
    await initStalwartProvisioning();
    const countAfter = await db.select().from(mailSyncLog).where(eq(mailSyncLog.operation, 'provision'));
    // Second run should skip already-provisioned resources
    expect(countAfter.length).toBe(countBefore.length);
  });

  it('should not block app startup on failure', async () => {
    // Mock Stalwart API to return 500
    mockStalwartApi.onPost('/api/principal').reply(500);
    // Should resolve without throwing
    await expect(initStalwartProvisioning()).resolves.not.toThrow();
  });

  it('should retry with exponential backoff on transient errors', async () => {
    // Mock first 2 calls to fail, 3rd to succeed
    mockStalwartApi
      .onPost('/api/principal').replyOnce(503)
      .onPost('/api/principal').replyOnce(503)
      .onPost('/api/principal').reply(200, { id: 'user1' });
    await initStalwartProvisioning();
    expect(mockStalwartApi.history.post.length).toBe(3);
  });

  it('should log all provisioning results to mail_sync_log', async () => {
    await initStalwartProvisioning();
    const logs = await db.select().from(mailSyncLog);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(l => l.operation === 'provision')).toBe(true);
  });
});
```

### Unit tests for ensureUserProvisioned

```typescript
describe('ensureUserProvisioned', () => {
  it('should create principal when user does not exist in Stalwart', async () => {
    mockStalwartApi.onGet('/api/principal/user@example.com').reply(404);
    mockStalwartApi.onPost('/api/principal').reply(200, { name: 'user@example.com' });
    mockStalwartApi.onAny(/MKCOL/).reply(201);

    await ensureUserProvisioned(mockCtx, 'user@example.com');
    expect(mockStalwartApi.history.post.length).toBe(1);
  });

  it('should skip creation when principal already exists', async () => {
    mockStalwartApi.onGet('/api/principal/user@example.com').reply(200, { name: 'user@example.com' });

    await ensureUserProvisioned(mockCtx, 'user@example.com');
    expect(mockStalwartApi.history.post.length).toBe(0);
  });

  it('should create DAV home directories when missing', async () => {
    mockStalwartApi.onGet('/api/principal/user@example.com').reply(200, { name: 'user@example.com' });
    // PROPFIND returns 404 for DAV home
    mockStalwartApi.onAny(/PROPFIND/).reply(404);
    mockStalwartApi.onAny(/MKCOL/).reply(201);

    await ensureUserProvisioned(mockCtx, 'user@example.com');
    // Should have attempted MKCOL for calendars, contacts, files
    const mkcolCalls = mockStalwartApi.history.filter(h => h.method === 'MKCOL');
    expect(mkcolCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('should retry MKCOL on 404 (parent collection missing)', async () => {
    mockStalwartApi.onGet('/api/principal/user@example.com').reply(200, { name: 'user@example.com' });
    mockStalwartApi.onAny(/MKCOL/).replyOnce(404).onAny(/MKCOL/).reply(201);

    await ensureUserProvisioned(mockCtx, 'user@example.com');
    // Should have retried
  });
});
```

### Frontend tests for health dashboard

```typescript
describe('HealthDashboard', () => {
  it('should render all 5 status states correctly', () => {
    const states = ['running', 'stopped', 'unreachable', 'auth_error', 'error'];
    for (const state of states) {
      const { getByText } = render(<HealthStatus status={state} />);
      expect(getByText(expectedLabel(state))).toBeInTheDocument();
    }
  });

  it('should display SMTP and IMAP status independently', () => {
    const { getByTestId } = render(
      <HealthDashboard
        serverStatus="running"
        smtpStatus="running"
        imapStatus="unreachable"
      />
    );
    expect(getByTestId('smtp-status')).toHaveTextContent('Running');
    expect(getByTestId('imap-status')).toHaveTextContent('Unreachable');
  });

  it('should format disk usage correctly', () => {
    const { getByText } = render(
      <DiskUsage usedBytes={1073741824} totalBytes={10737418240} />
    );
    expect(getByText('1.0 GB / 10.0 GB')).toBeInTheDocument();
    expect(getByText('10%')).toBeInTheDocument();
  });
});
```

## Anti-Patterns to Avoid

### FORBIDDEN: Inferring protocol status from HTTP health

```typescript
// WRONG — assumes SMTP is up because HTTP API is up
const health = await fetch('http://stalwart:8080/api/healthz');
return { smtp: health.ok, imap: health.ok }; // Both inferred from HTTP

// CORRECT — check each protocol independently
const httpOk = await checkHttp('http://stalwart:8080/api/healthz');
const smtpOk = await checkTcpPort('stalwart', 25);
const imapOk = await checkTcpPort('stalwart', 993);
return { server: httpOk, smtp: smtpOk, imap: imapOk };
```

### FORBIDDEN: Blocking startup on provisioning failure

```typescript
// WRONG — app won't start if Stalwart is down
await initStalwartProvisioning(); // throws on failure
startApp();

// CORRECT — non-blocking, log and continue
try {
  await initStalwartProvisioning();
} catch (err) {
  logger.error('Stalwart provisioning failed, will retry later', err);
}
startApp(); // always starts
```

### FORBIDDEN: Skipping ensureUserProvisioned guard

```typescript
// WRONG — DAV operation without guard, fails with 404 if user not provisioned
const calendars = await davClient.propfind(`/dav/calendars/user/${email}/`);

// CORRECT — guard ensures principal + DAV home exist first
await ensureUserProvisioned(ctx, email);
const calendars = await davClient.propfind(`/dav/calendars/user/${email}/`);
```

## File Location Reference

| Layer | Location |
|-------|----------|
| Backend Tests | `serverlessbase/packages/server/src/services/stalwart/__tests__/` |
| Frontend Tests | `client/src/__tests__/stalwart/` |
| MSW Handlers | `client/src/__tests__/mocks/stalwart-handlers.ts` |
| Test Fixtures | `client/src/__tests__/fixtures/stalwart/` |
