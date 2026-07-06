import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Whitelist app source. Runtime-loaded dep files with tsup sourcemaps
      // (cjs_shims, ioredis) bypass `exclude` in this provider version but are
      // reliably dropped by `include`.
      include: ['src/**'],
      exclude: [
        // A custom `exclude` REPLACES vitest's defaults — keep the
        // node_modules guard as belt-and-braces alongside `include`.
        '**/node_modules/**',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/server.ts',
        // Thin CLI seam over the tested seedSuperadmin() — like src/server.ts.
        'src/seed-superadmin.ts',
        // Thin CLI seam over the tested seedPricingTiers() — like above.
        'src/seed-pricing-tiers.ts',
        'src/config/logger.ts',
        // Thin ioredis + rate-limit-redis seam wired at boot from server.ts —
        // real socket, mocked in unit tests via `setRedisStoreFactory` in
        // `shared/middleware/coverage.test.ts`. Mirrors how server.ts is
        // excluded above.
        'src/shared/middleware/rate-limit-redis-store.ts',
        // NOTE: src/config/db.ts is intentionally NOT excluded — the v8
        // all-files scan in vitest 2.1.9 emits a 0% stub for excluded-but-
        // unimported files while filtering their runtime coverage, which
        // permanently fails the 100% gate. db.ts is covered directly by
        // src/config/db.test.ts (mocked mongoose) instead.
        // Build/test tooling config — not application source.
        'tsup.config.ts',
        'vitest.config.ts',
        'eslint.config.js',
        // Generated coverage reports occasionally land under src/ — never source.
        '**/coverage/**',
      ],
      // Prompt 11: CI enforces a 100% coverage gate on the four v8 dimensions.
      // Runs are gated by .github/workflows/ci.yml — see docs/ci-gates.en.md.
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
