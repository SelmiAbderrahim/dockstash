// First path segments of the CSR-only authenticated app — served as the bare
// CSR shell, never SSR'd. Single source for server.js.
//
// Parity with the actual app-shell route tree is enforced by
// src/app/appPaths.test.ts: every top-level app route segment must appear
// here, or the SSR 404 catch-all would swallow it.
export const APP_PREFIXES = [
  '/dashboard',
  '/profile',
  '/billing',
  '/checkout',
  '/admin',
  '/login',
  '/register',
  '/logout',
  '/oauth',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/settings',
  '/setup',
  '/projects',
  '/snapshots',
  '/fleet',
  '/health',
  '/superadmin',
];
