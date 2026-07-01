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
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/server.ts',
        'src/config/logger.ts',
        // DB bootstrap is an integration seam (like server.ts), not unit source.
        'src/config/db.ts',
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
