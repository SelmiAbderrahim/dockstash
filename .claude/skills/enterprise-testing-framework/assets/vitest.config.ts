import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test configuration
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration (MANDATORY: 90%+ requirement)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'coverage',

      // MANDATORY: 90%+ coverage thresholds
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },

        // Per-file thresholds to ensure comprehensive coverage
        './src/**/*.{ts,tsx}': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        },

        './convex/**/*.ts': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        }
      },

      // Include all relevant files
      include: [
        'src/**/*.{ts,tsx}',
        'convex/**/*.ts'
      ],

      // Exclude configuration and test files
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        'vite.config.ts',
        'vitest.config.ts'
      ],

      // Watermarks for coverage visualization
      watermarks: {
        statements: [80, 95],
        functions: [80, 95],
        branches: [75, 90],
        lines: [80, 95]
      }
    },

    // Test file patterns
    include: [
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
      'convex/tests/**/*.{test,spec}.{ts}',
      'tests/**/*.{test,spec}.{ts,tsx}'
    ],

    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'build/**'
    ],

    // Test timeout configuration
    testTimeout: 10000, // 10 seconds per test
    hookTimeout: 10000,  // 10 seconds for hooks

    // Parallel execution configuration
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4, // Limit threads to prevent resource exhaustion
        minThreads: 1
      }
    },

    // Reporting configuration
    reporter: [
      'verbose',        // Detailed output during development
      'json',           // JSON output for CI/CD integration
      'html'            // HTML report for detailed analysis
    ],

    // Output file configuration
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html'
    },

    // Watch mode configuration
    watch: false, // Disabled for CI runs

    // Global test configuration
    globals: true,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      CONVEX_URL: 'http://localhost:3210',
      SKIP_AUTH: 'true'
    },

    // Test isolation
    isolate: true,

    // Cache configuration
    cache: {
      dir: './node_modules/.vitest'
    }
  },

  // Resolve configuration for TypeScript paths
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@types': path.resolve(__dirname, './src/types'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },

  // Define global constants
  define: {
    __TEST__: true,
    __DEV__: false
  },

  // CSS processing configuration
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  }
});