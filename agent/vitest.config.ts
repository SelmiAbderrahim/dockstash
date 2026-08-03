import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**'],
      exclude: [
        '**/node_modules/**',
        'src/**/*.test.ts',
        // Thin boot seam over the tested runAgent() — mirrors the server's
        // excluded src/server.ts (never imported by tests, so no 0% stub).
        'src/index.ts',
        'vitest.config.ts',
      ],
      // Same 100% four-dimension gate as server/client — docs/ci-gates.en.md.
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
