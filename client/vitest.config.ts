import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Measure application source only — never vendored bundles, tooling
      // config, the SSR entry server, or build scripts.
      include: ['src/**/*.{ts,tsx}'],
      all: true,
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/entry-client.tsx',
        'src/entry-server.tsx',
        // App-shell composition roots (mirror the entry-point exclusions above):
        // they only wire providers/router together — no unit-testable logic.
        'src/App.tsx',
        'src/app/providers.tsx',
        'src/app/router.tsx',
        // Generated shadcn/ui primitives — vendored component source, not
        // hand-written app logic (mirrors the vendor-bundle exclusion below).
        'src/shared/ui/**',
        // shadcn CLI-generated hook (ships with the sidebar primitive).
        'src/shared/hooks/use-mobile.ts',
        // SSR i18n bootstrap — the server-side counterpart of entry-server.
        'src/shared/i18n/server.ts',
        'src/test/**',
        // Non-application source: tooling config, the SSR entry server, and
        // build scripts are not unit-tested app code.
        'vite.config.ts',
        'vitest.config.ts',
        'eslint.config.js',
        'server.js',
        'scripts/**',
        '**/node_modules/**',
        // Minified vendor bundles (e.g. React's prod CJS) are not app source.
        '**/*.min.js',
        '**/coverage/**',
        // Type-only modules compile to nothing; no runtime to cover.
        '**/types.ts',
      ],
      // Prompt 11: CI enforces 100% coverage across all four dimensions.
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
