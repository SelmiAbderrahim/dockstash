import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration for Enterprise Testing Framework
 *
 * MANDATORY: 100% pass rate for E2E tests on critical user journeys
 * Supports cross-browser testing, accessibility validation, and performance monitoring
 */
export default defineConfig({
  // Test directory configuration
  testDir: './tests/e2e',

  // Global test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // forbidOnly mode in CI
  retries: process.env.CI ? 2 : 0, // Retry 2 times in CI
  workers: process.env.CI ? 1 : undefined, // Single worker in CI

  // Test reporter configuration
  reporter: [
    ['html', { outputFolder: './test-results/e2e-html' }],
    ['json', { outputFile: './test-results/e2e-results.json' }],
    ['junit', { outputFile: './test-results/e2e-junit.xml' }],
    ['line'], // Console output during development
  ],

  // Global test timeout
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 5000 // 5 seconds per assertion
  },

  // Test artifact configuration
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:5173',

    // Browser configuration
    trace: 'on-first-retry', // Capture trace on first retry
    screenshot: 'only-on-failure', // Screenshot on failure
    video: 'retain-on-failure', // Video recording on failure

    // Viewport configuration
    viewport: { width: 1280, height: 720 },

    // Test isolation
    isolateLocalStorage: true,
    isolateHTTPConnections: true,

    // Action and navigation timeouts
    actionTimeout: 15000, // 15 seconds for actions
    navigationTimeout: 30000, // 30 seconds for navigation

    // Test execution speed
    launchOptions: {
      slowMo: process.env.CI ? 0 : 100 // Slow mode for local debugging
    }
  },

  // Browser project configuration
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
        }
      },
      testMatch: [
        '**/critical-user-journeys.spec.ts',
        '**/cross-browser.spec.ts'
      ]
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'security.fileuri.strict_origin_policy': false,
            'webgl.disabled': true
          }
        }
      },
      testMatch: [
        '**/cross-browser.spec.ts'
      ]
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        launchOptions: {
          args: [
            '--disable-web-security'
          ]
        }
      },
      testMatch: [
        '**/cross-browser.spec.ts'
      ]
    },

    // Mobile testing configurations
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--disable-web-security']
        }
      },
      testMatch: [
        '**/mobile.spec.ts',
        '**/responsive-design.spec.ts'
      ]
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
        launchOptions: {
          args: ['--disable-web-security']
        }
      },
      testMatch: [
        '**/mobile.spec.ts',
        '**/responsive-design.spec.ts'
      ]
    },

    // Tablet testing
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad Pro'],
        launchOptions: {
          args: ['--disable-web-security']
        }
      },
      testMatch: [
        '**/tablet.spec.ts',
        '**/responsive-design.spec.ts'
      ]
    },

    // Accessibility testing project
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--force-color-profile=srgb']
        }
      },
      testMatch: [
        '**/accessibility.spec.ts',
        '**/wcag-compliance.spec.ts'
      ],
      dependencies: ['chromium']
    },

    // Performance testing project
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ]
        }
      },
      testMatch: [
        '**/performance.spec.ts',
        '**/loading.spec.ts'
      ],
      dependencies: ['chromium']
    }
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes startup timeout
    stdout: 'ignore', // Ignore server output to reduce noise
    stderr: 'pipe'
  },

  // Global setup and teardown
  globalSetup: path.resolve(__dirname, './tests/e2e/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './tests/e2e/global-teardown.ts'),

  // Output directory configuration
  outputDir: './test-results/e2e-artifacts',

  // Metadata for test organization
  metadata: {
    'test-run-id': process.env.TEST_RUN_ID || `run-${Date.now()}`,
    'test-environment': process.env.NODE_ENV || 'test',
    'browser-versions': 'auto',
    'platform': process.platform
  },

  // Test dependencies for project ordering
  dependencies: ['chromium', 'firefox', 'webkit'],

  // Global test configuration
  grep: process.env.GREP ? new RegExp(process.env.GREP) : undefined,
  grepInvert: process.env.GREP_INVERT ? new RegExp(process.env.GREP_INVERT) : undefined,

  // Configuration for different test suites
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/test-results/**',
    '**/.git/**'
  ],

  // Timeout configuration for different scenarios
  expect: {
    // Assertion timeout
    timeout: 5000,

    // Custom matchers configuration
    toHaveScreenshot: {
      animationFrameWait: 2000,
      mode: 'auto' // Use 'auto' for CI, 'off' for local development
    }
  },

  // Reporter options for different output formats
  reporterOptions: {
    'html': {
      open: process.env.CI ? 'never' : 'on-failure'
    },
    'json': {
      outputFile: './test-results/e2e-results.json'
    },
    'junit': {
      outputFile: './test-results/e2e-junit.xml',
      stripANSIControlSequences: true
    }
  }
});