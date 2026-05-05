---
name: enterprise-testing-framework
description: Comprehensive enterprise testing framework for iReadYouTube project enforcing 90%+ test coverage requirements across all layers (unit, integration, E2E, performance, security, accessibility). Use when setting up test infrastructure, writing tests, validating coverage, or implementing quality gates for the React + TypeScript + Convex + AssemblyAI stack.
license: MIT
allowed-tools: ["code-interpreter"]
metadata:
  version: "1.0"
  author: "Testing Framework Specialist"
  category: "quality-assurance"
  coverage-requirement: "90%+"
  testing-stack: "Vitest + React Testing Library + Playwright + Convex Test Utilities"
---

# Enterprise Testing Framework

## Overview

**MANDATORY**: This skill implements enterprise-grade testing standards with **90%+ test coverage requirement** for all code. No exceptions, no compromises. The iReadYouTube project enforces zero tolerance for quality issues across all testing layers.

**Keywords**: testing, test coverage, quality gates, enterprise testing, Vitest, React Testing Library, Playwright, Convex testing, AssemblyAI testing, Docker testing, accessibility testing, security testing, performance testing

## When to Use This Skill

**IMMEDIATE ACTIVATION REQUIRED** for:
- Setting up test infrastructure for new features
- Writing any tests (unit, integration, E2E)
- Validating test coverage meets 90%+ minimum
- Implementing quality gates and CI/CD validation
- Testing Convex functions and schemas (self-hosted)
- Testing AssemblyAI integration with proper mocking
- Performance and security testing implementation
- Accessibility testing with WCAG 2.1 AA compliance

## MANDATORY COVERAGE REQUIREMENTS

**NON-NEGOTIABLE STANDARDS**:
- **Unit Test Coverage**: Minimum 90% line coverage (absolute requirement)
- **Integration Tests**: 100% pass rate for all integration points
- **E2E Tests**: 100% pass rate for critical user journeys
- **TypeScript**: Zero errors, zero warnings (strict mode)
- **ESLint**: Zero violations (max-warnings 0)
- **Security Tests**: Zero critical/high vulnerabilities
- **Accessibility**: WCAG 2.1 AA compliance required

### Quality Gates Enforcement

**AUTOMATIC REJECTION** for any failure:
- Pull requests blocked below 90% coverage
- Deployment blocked with any test failures
- Code review blocked without comprehensive tests
- Quality workflow halted for quality violations

## Testing Technology Stack

### Core Framework Stack
- **Unit Tests**: Vitest with React Testing Library
- **Integration Tests**: Convex Test Utilities (self-hosted)
- **E2E Tests**: Playwright with browser automation
- **Performance Tests**: Lighthouse CI integration
- **Security Tests**: OWASP ZAP integration
- **Accessibility Tests**: axe-core automated testing

### Docker-Based Testing (MANDATORY)
**ALL TESTING MUST RUN IN DOCKER CONTAINERS**:
```bash
# ✅ CORRECT: Docker-based testing
make test                     # Run all tests in Docker
make test:unit               # Run unit tests in Docker
make test:integration        # Run integration tests in Docker
make test:e2e               # Run E2E tests in Docker

# ❌ FORBIDDEN: Host machine testing
npm test                     # WRONG - Use Docker commands
npm run test                 # WRONG - Use Docker commands
```

## Process / Workflow

### Step 1: Test Infrastructure Setup

**MANDATORY PREREQUISITES** before any development:

1. **Validate Docker Testing Environment**:
```bash
# Verify test environment is healthy
make healthcheck
make test:validate
```

2. **Configure Coverage Requirements**:
```bash
# Set up 90%+ coverage enforcement
npm run setup:coverage
```

3. **Install Test Dependencies** (in Docker):
```bash
make install TEST_DEPS=true
```

### Step 2: Test-First Development (TDD)

**ABSOLUTE REQUIREMENT**: Write tests BEFORE implementation:

1. **Write Failing Tests**:
```bash
# Create test files first (before implementation)
touch src/components/VideoCard.test.tsx
touch convex/tests/videos.test.ts
touch tests/e2e/video-workflow.spec.ts
```

2. **Run Tests to Verify Failure**:
```bash
make test:watch              # Watch mode in Docker
```

3. **Implement Minimum Code to Pass**:
```bash
# Implement just enough to make tests pass
make dev-restart             # Reload in Docker
```

4. **Refactor and Improve Coverage**:
```bash
make test:coverage           # Verify 90%+ coverage
```

### Step 3: Multi-Layer Testing Strategy

**MANDATORY TESTING LAYERS** (all must pass):

#### 3.1 Unit Testing (90%+ Coverage)

**Vitest + React Testing Library Setup**:
```typescript
// vitest.config.ts - REQUIRED CONFIGURATION
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**React Component Testing Pattern**:
```typescript
// src/components/VideoCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoCard } from './VideoCard';

// Mock external dependencies
vi.mock('@/hooks/useTranscript', () => ({
  useTranscript: vi.fn()
}));

describe('VideoCard Component', () => {
  const mockVideo = {
    id: 'test-video-id',
    title: 'Test Video Title',
    description: 'Test Description',
    status: 'completed' as const,
    createdAt: Date.now()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders video information correctly', () => {
    render(<VideoCard video={mockVideo} />);

    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('handles click interactions properly', async () => {
    const mockOnClick = vi.fn();
    render(<VideoCard video={mockVideo} onClick={mockOnClick} />);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(mockOnClick).toHaveBeenCalledWith(mockVideo.id);
    });
  });

  it('displays loading state during processing', () => {
    const processingVideo = { ...mockVideo, status: 'processing' as const };
    render(<VideoCard video={processingVideo} />);

    expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
  });
});
```

#### 3.2 Convex Backend Testing

**Self-Hosted Convex Testing Pattern**:
```typescript
// convex/test-setup.ts
import { convexTest } from 'convex-test';
import { api } from '../_generated/api';
import schema from '../schema';

export const testCtx = convexTest(schema, {
  auth: {
    userId: 'test-user-id',
    subjectId: 'test-user-id',
  }
});

// convex/tests/videos.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testCtx } from '../test-setup';

describe('Video Functions', () => {
  beforeEach(async () => {
    // Clean up test data
    await testCtx.run(async (ctx) => {
      const videos = await ctx.db.query('videos').collect();
      for (const video of videos) {
        await ctx.db.delete(video._id);
      }
    });
  });

  it('creates video with proper validation', async () => {
    const videoData = {
      title: 'Test Video',
      youtubeUrl: 'https://youtube.com/watch?v=test',
      description: 'Test Description'
    };

    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        ...videoData,
        userId: 'test-user-id',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    const video = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video).toBeDefined();
    expect(video?.title).toBe(videoData.title);
    expect(video?.youtubeUrl).toBe(videoData.youtubeUrl);
  });

  it('enforces video URL validation', async () => {
    const invalidData = {
      title: 'Test Video',
      youtubeUrl: 'invalid-url',
      description: 'Test Description'
    };

    await expect(
      testCtx.run(async (ctx) => {
        return await ctx.db.insert('videos', {
          ...invalidData,
          userId: 'test-user-id',
          status: 'processing',
          createdAt: Date.now()
        });
      })
    ).rejects.toThrow();
  });
});
```

#### 3.3 AssemblyAI Integration Testing

**AssemblyAI API Mocking Pattern**:
```typescript
// tests/mocks/assemblyai.ts
import { vi } from 'vitest';

export const mockAssemblyAI = {
  transcripts: {
    transcribe: vi.fn().mockResolvedValue({
      id: 'test-transcript-id',
      status: 'queued',
      audio_url: 'https://example.com/audio.mp3'
    }),
    get: vi.fn().mockResolvedValue({
      id: 'test-transcript-id',
      status: 'completed',
      text: 'Test transcript content',
      words: [
        { text: 'Test', start: 0, end: 500 },
        { text: 'transcript', start: 600, end: 1200 },
        { text: 'content', start: 1300, end: 2000 }
      ]
    })
  }
};

// tests/integration/assemblyai.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transcribeVideo } from '../../convex/lib/assemblyai';
import { testCtx } from '../../convex/test-setup';
import { mockAssemblyAI } from '../mocks/assemblyai';

vi.mock('assemblyai', () => ({
  AssemblyAI: vi.fn().mockImplementation(() => mockAssemblyAI)
}));

describe('AssemblyAI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits transcription request successfully', async () => {
    const audioUrl = 'https://example.com/audio.mp3';

    const result = await testCtx.run(async (ctx) => {
      return await transcribeVideo(ctx, {
        videoId: 'test-video-id',
        audioUrl,
        options: { speakerLabels: true }
      });
    });

    expect(result.success).toBe(true);
    expect(mockAssemblyAI.transcripts.transcribe).toHaveBeenCalledWith({
      audio: audioUrl,
      speaker_labels: true,
      language_code: undefined,
      punctuate: true
    });
  });

  it('handles API errors gracefully', async () => {
    mockAssemblyAI.transcripts.transcribe.mockRejectedValue(
      new Error('API Error')
    );

    await expect(
      testCtx.run(async (ctx) => {
        return await transcribeVideo(ctx, {
          videoId: 'test-video-id',
          audioUrl: 'https://example.com/audio.mp3'
        });
      })
    ).rejects.toThrow('Transcription failed');
  });
});
```

#### 3.4 E2E Testing with Playwright

**Playwright Configuration for Docker**:
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'make start',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

**E2E Test Examples**:
```typescript
// tests/e2e/video-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Video Upload and Transcription Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('completes full YouTube video workflow', async ({ page }) => {
    // 1. Upload YouTube URL
    await page.fill('[data-testid="youtube-url-input"]', 'https://youtube.com/watch?v=test');
    await page.click('[data-testid="upload-button"]');

    // 2. Verify processing state
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-processing"]')).toContainText('Processing');

    // 3. Wait for completion
    await expect(page.locator('[data-testid="status-completed"]')).toBeVisible({
      timeout: 30000
    });

    // 4. Verify transcript display
    await expect(page.locator('[data-testid="transcript-viewer"]')).toBeVisible();
    await expect(page.locator('[data-testid="transcript-content"]')).toContainText('Sample transcript');

    // 5. Test transcript navigation
    await page.click('[data-testid="timestamp-0"]');
    await expect(page.locator('[data-testid="video-player"]')).toHaveAttribute('currentTime', '0');
  });

  test('handles file upload workflow', async ({ page }) => {
    // Test file upload with different formats
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles('test-fixtures/sample-video.mp4');

    await page.click('[data-testid="upload-button"]');
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
  });

  test('validates required fields', async ({ page }) => {
    // Test form validation
    await page.click('[data-testid="upload-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('YouTube URL is required');

    // Test URL validation
    await page.fill('[data-testid="youtube-url-input"]', 'invalid-url');
    await page.click('[data-testid="upload-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Please enter a valid YouTube URL');
  });
});
```

#### 3.5 Performance Testing

**Lighthouse CI Integration**:
```typescript
// tests/performance/lighthouse.config.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5173'],
      startServerCommand: 'make start',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

#### 3.6 Security Testing

**OWASP ZAP Integration**:
```typescript
// tests/security/zap.config.js
const ZAP = require('zaproxy');

module.exports = {
  target: 'http://localhost:5173',
  options: {
    '-a': true,                // ignore warnings
    '-j': true,                // JSON output
    '-t': 300000,              // timeout 5 minutes
    '--ignore': '/tests/',     // ignore test routes
  },
  alerts: {
    level: 'HIGH',             // HIGH or MEDIUM only
    codes: [
      // OWASP Top 10 security issues
      10021, // XSS
      10024, // SQL Injection
      10017, // Path Traversal
      10055, // Remote File Inclusion
    ]
  }
};
```

#### 3.7 Accessibility Testing

**axe-core Integration**:
```typescript
// tests/accessibility/a11y.config.ts
import { injectAxe, getViolations } from 'axe-playwright';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await injectAxe(page);
});

test.describe('Accessibility Testing', () => {
  test('meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/');

    const violations = await getViolations(page);
    expect(violations).toHaveLength(0);
  });

  test('keyboard navigation works properly', async ({ page }) => {
    await page.goto('/');

    // Tab through all interactive elements
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Test Enter key on buttons
    await page.keyboard.press('Enter');

    // Test Escape key for modals
    await page.keyboard.press('Escape');
  });

  test('screen reader compatibility', async ({ page }) => {
    await page.goto('/');

    // Test ARIA labels and roles
    const button = page.locator('[data-testid="upload-button"]');
    await expect(button).toHaveAttribute('aria-label');

    // Test heading hierarchy
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    await expect(headings).toHaveCount({ min: 1 });
  });
});
```

### Step 4: Test Data Management

**Test Fixtures and Data Management**:
```typescript
// tests/fixtures/videoData.ts
export const videoFixtures = {
  validYouTube: {
    title: 'Test YouTube Video',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Test video description'
  },
  processingVideo: {
    title: 'Processing Video',
    youtubeUrl: 'https://www.youtube.com/watch?v=processing',
    status: 'processing' as const
  },
  completedVideo: {
    title: 'Completed Video',
    youtubeUrl: 'https://www.youtube.com/watch?v=completed',
    status: 'completed' as const,
    transcriptId: 'test-transcript-id'
  }
};

export const transcriptFixtures = {
  sampleTranscript: {
    id: 'test-transcript-id',
    text: 'This is a sample transcript for testing purposes.',
    words: [
      { text: 'This', start: 0, end: 300 },
      { text: 'is', start: 400, end: 600 },
      { text: 'a', start: 700, end: 850 },
      { text: 'sample', start: 950, end: 1400 },
      { text: 'transcript', start: 1500, end: 2200 }
    ]
  }
};
```

### Step 5: Coverage Validation and Reporting

**Coverage Requirements Enforcement**:
```bash
#!/bin/bash
# scripts/validate-coverage.sh - MANDATORY COVERAGE VALIDATION

echo "🔍 VALIDATING TEST COVERAGE REQUIREMENTS (90%+ MINIMUM)"

# Run coverage report
npm run test:coverage

# Extract coverage percentages
COVERAGE=$(npm run test:coverage -- --reporter=json | jq '.total.lines.pct')

# Validate 90%+ coverage
if (( $(echo "$COVERAGE < 90" | bc -l) )); then
  echo "❌ COVERAGE FAILURE: ${COVERAGE}% is below 90% minimum"
  echo "❌ BLOCKING: Cannot proceed with coverage below 90%"
  exit 1
fi

echo "✅ COVERAGE SUCCESS: ${COVERAGE}% meets 90%+ requirement"

# Validate layer-specific coverage
UNIT_COVERAGE=$(npm run test:unit:coverage | jq '.total.lines.pct')
INTEGRATION_COVERAGE=$(npm run test:integration -- --coverage | jq '.total.lines.pct')

echo "✅ Unit Coverage: ${UNIT_COVERAGE}%"
echo "✅ Integration Coverage: ${INTEGRATION_COVERAGE}%"
echo "✅ All coverage requirements met - PROCEEDING"
```

### Step 6: Quality Gates Integration

**Automated Quality Gate Validation**:
```typescript
// scripts/quality-gates.ts
interface QualityGateResult {
  passed: boolean;
  metrics: {
    coverage: number;
    unitTests: number;
    integrationTests: number;
    e2eTests: number;
    securityVulnerabilities: number;
    accessibilityViolations: number;
    performanceScore: number;
  };
  failures: string[];
}

export async function validateQualityGates(): Promise<QualityGateResult> {
  const results: QualityGateResult = {
    passed: true,
    metrics: {
      coverage: 0,
      unitTests: 0,
      integrationTests: 0,
      e2eTests: 0,
      securityVulnerabilities: 0,
      accessibilityViolations: 0,
      performanceScore: 0
    },
    failures: []
  };

  // 1. Coverage Validation (90%+ mandatory)
  const coverageReport = await getCoverageReport();
  results.metrics.coverage = coverageReport.total.lines.pct;

  if (results.metrics.coverage < 90) {
    results.passed = false;
    results.failures.push(`Coverage ${results.metrics.coverage}% below 90% minimum`);
  }

  // 2. Unit Test Validation
  const unitTestResults = await runUnitTests();
  results.metrics.unitTests = unitTestResults.passed ? 1 : 0;

  if (!unitTestResults.passed) {
    results.passed = false;
    results.failures.push('Unit tests failed');
  }

  // 3. Integration Test Validation
  const integrationResults = await runIntegrationTests();
  results.metrics.integrationTests = integrationResults.passed ? 1 : 0;

  if (!integrationResults.passed) {
    results.passed = false;
    results.failures.push('Integration tests failed');
  }

  // 4. E2E Test Validation
  const e2eResults = await runE2ETests();
  results.metrics.e2eTests = e2eResults.passed ? 1 : 0;

  if (!e2eResults.passed) {
    results.passed = false;
    results.failures.push('E2E tests failed');
  }

  // 5. Security Validation
  const securityScan = await runSecurityScan();
  results.metrics.securityVulnerabilities = securityScan.critical + securityScan.high;

  if (results.metrics.securityVulnerabilities > 0) {
    results.passed = false;
    results.failures.push(`Security issues found: ${results.metrics.securityVulnerabilities}`);
  }

  // 6. Accessibility Validation
  const accessibilityResults = await runAccessibilityTests();
  results.metrics.accessibilityViolations = accessibilityResults.violations.length;

  if (results.metrics.accessibilityViolations > 0) {
    results.passed = false;
    results.failures.push(`Accessibility violations: ${results.metrics.accessibilityViolations}`);
  }

  // 7. Performance Validation
  const performanceResults = await runPerformanceTests();
  results.metrics.performanceScore = performanceResults.score;

  if (results.metrics.performanceScore < 90) {
    results.passed = false;
    results.failures.push(`Performance score ${results.metrics.performanceScore} below 90`);
  }

  return results;
}
```

## Guidelines

### 🚨 MANDATORY TESTING PRINCIPLES

1. **90%+ COVERAGE REQUIREMENT**: Non-negotiable minimum for all code
2. **TEST-FIRST DEVELOPMENT**: Write tests BEFORE implementation
3. **DOCKER TESTING ONLY**: All tests must run in Docker containers
4. **ZERO TOLERANCE**: No exceptions to quality standards
5. **AUTOMATIC BLOCKING**: CI/CD blocks non-compliant code

### 🎯 Coverage Achievement Strategies

1. **Test-Driven Development**: Write failing tests first, then implement
2. **Edge Case Coverage**: Test all possible inputs, outputs, and error conditions
3. **Integration Points**: Test all external API integrations with proper mocking
4. **User Workflows**: End-to-end testing for critical user journeys
5. **Component Isolation**: Test React components independently and in integration
6. **Convex Functions**: Test all database operations and business logic
7. **Error Handling**: Comprehensive error condition testing

### 🔧 Testing Best Practices

1. **Descriptive Test Names**: Use "should [behavior] when [condition]" format
2. **Arrange-Act-Assert**: Structure tests clearly with setup, execution, verification
3. **Test Data Management**: Use fixtures for consistent test data
4. **Mock External Dependencies**: Mock all external services and APIs
5. **Test Isolation**: Tests should not depend on each other
6. **Performance Considerations**: Keep tests fast and efficient
7. **Maintainability**: Write clear, readable, and maintainable test code

### 📊 Test Organization Standards

1. **Co-located Tests**: Place test files next to source files
2. **Test Directories**: Organize by type (unit, integration, e2e)
3. **Naming Conventions**: Use `.test.ts`, `.spec.ts`, `.test.tsx` extensions
4. **Test Utilities**: Shared utilities in `tests/utils/`
5. **Mock Management**: Organized mocks in `tests/mocks/`
6. **Fixtures**: Test data in `tests/fixtures/`
7. **Configuration**: Test configs at root level

## Examples

### Example 1: React Component Testing with Shadcn/ui Compliance

```typescript
// src/components/ui/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with primary styling by default', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveTextContent('Click me');
  });

  it('applies variant styling correctly', () => {
    render(<Button variant="secondary">Secondary</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-secondary');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports disabled state', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('uses design system tokens', () => {
    const { container } = render(<Button>Test</Button>);
    const button = container.querySelector('button');

    // Verify CSS custom properties are used
    expect(button).toHaveStyle({
      'border-radius': 'var(--radius-lg)',
      'padding': 'var(--space-3) var(--space-4)'
    });
  });
});
```

### Example 2: Convex Function Testing with Self-Hosted Setup

```typescript
// convex/tests/transcription.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testCtx } from '../test-setup';
import { api } from '../_generated/api';

// Mock AssemblyAI for testing
vi.mock('../lib/assemblyai', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    id: 'test-transcript-id',
    text: 'Test transcription result',
    words: [{ text: 'Test', start: 0, end: 500 }]
  })
}));

describe('Transcription Functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Clean up test data
    await testCtx.run(async (ctx) => {
      const videos = await ctx.db.query('videos').collect();
      for (const video of videos) {
        await ctx.db.delete(video._id);
      }
    });
  });

  it('creates transcription job successfully', async () => {
    const videoData = {
      title: 'Test Video',
      youtubeUrl: 'https://youtube.com/watch?v=test'
    };

    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        ...videoData,
        userId: 'test-user-id',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Call the transcription function
    const result = await testCtx.run(async (ctx) => {
      return await ctx.scheduler.runAfter(0, api.videos.startTranscription, {
        videoId,
        audioUrl: 'https://example.com/audio.mp3'
      });
    });

    expect(result.success).toBe(true);

    // Verify video status updated
    const video = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video?.status).toBe('completed');
  });

  it('handles transcription errors properly', async () => {
    const videoData = {
      title: 'Error Video',
      youtubeUrl: 'https://youtube.com/watch?v=error'
    };

    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        ...videoData,
        userId: 'test-user-id',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Mock AssemblyAI error
    const { transcribeAudio } = await import('../lib/assemblyai');
    vi.mocked(transcribeAudio).mockRejectedValue(new Error('API Error'));

    const result = await testCtx.run(async (ctx) => {
      return await ctx.scheduler.runAfter(0, api.videos.startTranscription, {
        videoId,
        audioUrl: 'https://example.com/audio.mp3'
      });
    });

    expect(result.success).toBe(false);

    // Verify video status updated to failed
    const video = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video?.status).toBe('failed');
  });

  it('validates video permissions before transcription', async () => {
    // Test with unauthorized user
    const unauthorizedCtx = convexTest(schema);

    await expect(
      unauthorizedCtx.run(async (ctx) => {
        return await ctx.scheduler.runAfter(0, api.videos.startTranscription, {
          videoId: 'unauthorized-video-id',
          audioUrl: 'https://example.com/audio.mp3'
        });
      })
    ).rejects.toThrow('Unauthorized');
  });
});
```

### Example 3: E2E Testing for Critical User Workflows

```typescript
// tests/e2e/critical-user-journeys.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Critical User Journeys - 100% Pass Rate Required', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Set up authentication if needed
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'test-token');
    });
  });

  test('YouTube video upload to transcript completion', async ({ page }) => {
    // This is a CRITICAL user journey - must always pass

    // 1. Navigate to upload page
    await page.click('[data-testid="upload-nav"]');
    await expect(page).toHaveURL('/upload');

    // 2. Enter YouTube URL
    await page.fill('[data-testid="youtube-url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.fill('[data-testid="video-title"]', 'Test Video Upload');
    await page.fill('[data-testid="video-description"]', 'Test Description');

    // 3. Submit form
    await page.click('[data-testid="submit-upload"]');

    // 4. Verify processing starts
    await expect(page.locator('[data-testid="processing-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-text"]')).toContainText('Processing video');

    // 5. Wait for completion (use mock for speed in tests)
    await page.evaluate(() => {
      // Mock the completion signal
      window.dispatchEvent(new CustomEvent('transcription-complete', {
        detail: { videoId: 'test-video-id' }
      }));
    });

    // 6. Verify completion and transcript display
    await expect(page.locator('[data-testid="completion-status"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="transcript-viewer"]')).toBeVisible();

    // 7. Test transcript functionality
    await expect(page.locator('[data-testid="transcript-content"]')).toContainText('Sample transcript');

    // 8. Test timestamp navigation
    await page.click('[data-testid="timestamp-0"]');
    await expect(page.locator('[data-testid="video-player"]')).toHaveAttribute('currentTime', '0');
  });

  test('Transcript search and navigation workflow', async ({ page }) => {
    // 1. Load a completed transcript
    await page.goto('/transcript/test-transcript-id');

    // 2. Verify transcript loads
    await expect(page.locator('[data-testid="transcript-content"]')).toBeVisible();

    // 3. Test search functionality
    await page.fill('[data-testid="search-input"]', 'test phrase');
    await page.click('[data-testid="search-button"]');

    // 4. Verify search results highlight
    await expect(page.locator('[data-testid="search-highlight"]')).toBeVisible();
    expect(await page.locator('[data-testid="search-highlight"]').count()).toBeGreaterThan(0);

    // 5. Test navigation between search results
    await page.click('[data-testid="next-result"]');
    await expect(page.locator('[data-testid="current-result"]')).toContainText('2');

    // 6. Test timestamp clicking from search
    await page.click('[data-testid="search-result-timestamp"]');
    await expect(page.locator('[data-testid="video-player"]')).toHaveAttribute('currentTime', /^\d+$/);
  });

  test('Responsive design across devices', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="mobile-menu-button"]')).not.toBeVisible();

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });
});
```

## Reference Files

- [📋 Coverage Validation Script](./scripts/validate-coverage.sh) - Enforces 90%+ coverage requirements
- [🔧 Test Automation Scripts](./scripts/) - Docker-based test runners and quality gates
- [📚 Testing Patterns Guide](./references/testing-patterns.md) - Comprehensive testing strategies
- [🔍 Convex Testing Guide](./references/convex-testing.md) - Self-hosted Convex testing patterns
- [🎭 AssemblyAI Mocking Guide](./references/assemblyai-mocking.md) - API integration testing with mocking
- [⚡ Performance Testing Setup](./references/performance-testing.md) - Lighthouse CI and performance validation
- [🔒 Security Testing Guide](./references/security-testing.md) - OWASP ZAP integration and security validation
- [♿ Accessibility Testing Guide](./references/accessibility-testing.md) - WCAG 2.1 AA compliance testing
- [📊 Test Configuration Templates](./assets/) - Vitest, Playwright, and testing framework configurations

## Troubleshooting

**Problem**: Test coverage below 90% requirement
**Solution**:
- Run `make test:coverage:report` to identify uncovered lines
- Add tests for uncovered edge cases and error conditions
- Use branch coverage to ensure all code paths are tested
- Check integration points and external dependencies

**Problem**: Tests failing in Docker but passing locally
**Solution**:
- Verify Docker environment variables with `make env:check`
- Ensure all test dependencies are installed in Docker with `make install TEST_DEPS=true`
- Check file permissions and mounting issues in Docker
- Use `make logs` to debug Docker test execution

**Problem**: Convex tests failing with self-hosted setup
**Solution**:
- Verify Convex backend is running with `make status`
- Check self-hosted Convex configuration in `docker/.env`
- Ensure test database schema matches production schema
- Use proper test context setup with `convexTest`

**Problem**: AssemblyAI integration tests unstable
**Solution**:
- Implement comprehensive mocking of AssemblyAI API
- Use deterministic test data and responses
- Add retry logic for network-dependent tests
- Mock external API responses consistently

**Problem**: E2E tests flaky and inconsistent
**Solution**:
- Increase wait times and add proper synchronization
- Use Playwright's auto-waiting features effectively
- Implement proper test data setup and cleanup
- Use realistic test data that mimics production scenarios

**Problem**: Performance tests failing quality gates
**Solution**:
- Optimize bundle size and loading performance
- Implement code splitting and lazy loading
- Optimize images and static assets
- Use caching strategies effectively

**Problem**: Security tests finding vulnerabilities
**Solution**:
- Implement proper input validation and sanitization
- Add authentication and authorization checks
- Configure proper CORS and CSP headers
- Regular dependency updates and vulnerability scanning

---

## 🚨 CRITICAL REMINDER

**THIS IS NOT OPTIONAL**: The 90%+ test coverage requirement is **MANDATORY** for all code. No exceptions, no compromises, no workarounds. The automated quality gates will **BLOCK** any code that doesn't meet these standards.

**QUALITY IS NOT NEGOTIABLE** - Every line of code must be tested, every feature must be validated, every edge case must be covered. The enterprise testing framework enforces these standards automatically.