# Comprehensive Testing Strategy Guide

## Complete Implementation Guide

### 1. Testing Pyramid Architecture

#### Structure Overview

```
      /\
     /  \  E2E Tests (5%)
    /----\  - Critical user paths
   /      \ - Cross-browser validation
  /--------\ Integration Tests (15%)
 /          \ - Feature workflows
/____________\ - API interactions
    Unit Tests (80%)
    - Component rendering
    - Hook behavior
    - Utilities
```

#### Why This Pyramid?

- **Unit tests (80%)**: Fast feedback, catch bugs early, <100ms per test
- **Integration tests (15%)**: Verify component interactions, API contracts
- **E2E tests (5%)**: Validate critical paths, slow but comprehensive

### 2. Test Organization Strategy

#### File Structure

```
client/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── __tests__/
│   │       ├── Button.test.tsx           # Unit test
│   │       ├── Button.visual.test.ts     # Visual regression
│   │       └── Button.a11y.test.ts       # Accessibility
│   │
│   ├── hooks/
│   │   ├── useVideoList.ts
│   │   └── __tests__/
│   │       └── useVideoList.test.ts
│   │
│   ├── lib/
│   │   ├── api.ts
│   │   └── __tests__/
│   │       └── api.test.ts
│   │
│   └── routes/
│       └── __tests__/
│           └── dashboard.integration.test.tsx
│
├── tests/
│   ├── e2e/
│   │   ├── flows/
│   │   │   ├── login.spec.ts
│   │   │   ├── upload-video.spec.ts
│   │   │   └── search-transcript.spec.ts
│   │   │
│   │   ├── pages/
│   │   │   ├── LoginPage.ts
│   │   │   ├── DashboardPage.ts
│   │   │   └── VideoDetailPage.ts
│   │   │
│   │   ├── a11y/
│   │   │   ├── navigation.spec.ts
│   │   │   └── form-accessibility.spec.ts
│   │   │
│   │   └── performance/
│   │       └── core-web-vitals.spec.ts
│   │
│   ├── integration/
│   │   ├── api.integration.test.ts
│   │   ├── auth.integration.test.ts
│   │   └── video-upload.integration.test.ts
│   │
│   ├── fixtures/
│   │   ├── mockData.ts
│   │   ├── mockServers.ts
│   │   └── testUsers.ts
│   │
│   ├── setup/
│   │   ├── vitest.setup.ts
│   │   └── playwright.setup.ts
│   │
│   └── utils/
│       ├── testHelpers.ts
│       ├── customMatchers.ts
│       └── renderWithProviders.ts
```

### 3. Layer-by-Layer Implementation

#### Phase 1: Unit Tests (Week 1-2)

**Focus**: Component rendering, hook behavior, utility functions

```typescript
// tests structure
mkdir -p client/src/components/__tests__
mkdir -p client/src/hooks/__tests__
mkdir -p client/src/lib/__tests__

// Create basic test
cat > client/src/components/Button/__tests__/Button.test.tsx << 'EOF'
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledOnce();
  });
});
EOF

// Run with coverage
npm run test:coverage -- Button.test.tsx
```

**Coverage Targets**:
- Lines: 90%+
- Functions: 90%+
- Branches: 90%+
- Statements: 90%+

**Command**:
```bash
make test  # Run all unit tests
make test FILTER="Button"  # Run specific test
```

#### Phase 2: Integration Tests (Week 3)

**Focus**: Multi-component workflows, API interactions, state management

```typescript
// tests/integration/auth.integration.test.ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/LoginForm';
import { mockAuthAPI } from '../fixtures/mockServers';

describe('Authentication Flow', () => {
  beforeEach(() => {
    mockAuthAPI.listen();
  });

  afterEach(() => {
    mockAuthAPI.close();
  });

  it('should login user successfully', async () => {
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });
  });

  it('should handle authentication errors', async () => {
    const user = userEvent.setup();
    mockAuthAPI.mockError('INVALID_CREDENTIALS');

    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
```

**Requirements**:
- 100% pass rate
- Mock external APIs (Convex, AssemblyAI)
- Test error scenarios
- Verify state changes

**Command**:
```bash
make test:integration
```

#### Phase 3: E2E Tests (Week 4)

**Focus**: Critical user paths, cross-browser testing

```typescript
// tests/e2e/flows/upload-video.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';

test('upload video from YouTube URL', async ({ page }) => {
  // Login
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');

  // Navigate to upload
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.clickUploadButton();

  // Upload
  const uploadPage = new UploadPage(page);
  await uploadPage.selectUploadMethod('youtube');
  await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await uploadPage.submitForm();

  // Verify
  await expect(page).toHaveURL(/.*videos.*/);
  await expect(page.getByText('Processing')).toBeVisible();
});
```

**Scope**: 3-5 critical user paths only
- Login/logout
- Video upload
- Transcript search
- Profile settings

**Command**:
```bash
make test:e2e
```

### 4. Testing Best Practices by Layer

#### Unit Testing Best Practices

```typescript
// ✅ CORRECT
describe('VideoCard', () => {
  it('should display video title', () => {
    const video = { id: '1', title: 'Test Video' };
    render(<VideoCard video={video} />);
    expect(screen.getByText('Test Video')).toBeInTheDocument();
  });

  it('should call onPlay when play button clicked', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();

    render(<VideoCard video={mockVideo} onPlay={onPlay} />);
    await user.click(screen.getByRole('button', { name: 'Play' }));

    expect(onPlay).toHaveBeenCalledWith(mockVideo.id);
  });

  it('should disable play button when video unavailable', () => {
    const unavailableVideo = { ...mockVideo, status: 'failed' };
    render(<VideoCard video={unavailableVideo} />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });
});

// ❌ WRONG
describe('VideoCard', () => {
  it('should work correctly', () => {
    const { container } = render(<VideoCard {...props} />);
    expect(container.innerHTML).toContain('video-card');
  });

  it('should handle all cases', () => {
    // Tests multiple behaviors at once
    render(<VideoCard />);
    // Multiple assertions on different things
  });
});
```

#### Integration Testing Best Practices

```typescript
// ✅ CORRECT - Test complete user workflows
describe('Video Upload Workflow', () => {
  it('should complete full upload from file selection to transcript', async () => {
    // 1. Setup
    const user = userEvent.setup();
    mockVideoAPI.mockSuccess({ id: 'video-1' });
    mockTranscriptionAPI.mockSuccess({ status: 'completed' });

    // 2. Render complete component tree
    render(
      <QueryClientProvider client={queryClient}>
        <UploadWorkflow />
      </QueryClientProvider>
    );

    // 3. Execute workflow
    const file = new File(['content'], 'video.mp4');
    await user.upload(screen.getByLabelText('Select video'), file);

    // 4. Wait for processing
    await waitFor(() => {
      expect(screen.getByText(/Upload complete/i)).toBeInTheDocument();
    });

    // 5. Verify state
    expect(mockVideoAPI.post).toHaveBeenCalledWith(
      expect.objectContaining({ file })
    );
  });
});

// ❌ WRONG - Testing in isolation
describe('UploadForm', () => {
  it('renders file input', () => {
    render(<UploadForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('input')).toBeInTheDocument();
  });

  it('calls onSubmit on button click', async () => {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalled();
  });
});
```

### 5. Test Configuration Examples

#### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
      exclude: ['node_modules/', 'dist/'],
    },
  },
  resolve: {
    alias: {
      '@': '/Users/macbook/Desktop/ireadyoutube/client/src',
    },
  },
});
```

#### Playwright Configuration

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
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### 6. Test Fixture Management

#### Mock Data

```typescript
// tests/fixtures/mockData.ts
export const mockUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'John Doe',
  createdAt: new Date('2024-01-01'),
};

export const mockVideo = {
  _id: 'video-1',
  userId: 'user-1',
  title: 'Test Video',
  url: 'https://www.youtube.com/watch?v=test',
  status: 'completed' as const,
  duration: 300,
  createdAt: new Date(),
};

export const mockTranscript = {
  _id: 'transcript-1',
  videoId: 'video-1',
  text: 'This is the transcript content...',
  segments: [
    { startTime: 0, endTime: 10, text: 'First segment' },
    { startTime: 10, endTime: 20, text: 'Second segment' },
  ],
};

export const createMockVideo = (overrides = {}) => ({
  ...mockVideo,
  ...overrides,
});
```

#### Mock API Servers

```typescript
// tests/fixtures/mockServers.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const mockAuthServer = setupServer(
  http.post('*/api/auth/login', () => {
    return HttpResponse.json({ token: 'mock-token' });
  }),
  http.post('*/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  })
);

export const mockVideoServer = setupServer(
  http.get('*/api/videos', () => {
    return HttpResponse.json([mockVideo]);
  }),
  http.post('*/api/videos', () => {
    return HttpResponse.json({ id: 'new-video' });
  })
);

export const allServers = setupServer(
  ...mockAuthServer.getHandlers(),
  ...mockVideoServer.getHandlers()
);
```

### 7. Coverage Reporting

#### Generate Report

```bash
# Generate coverage
make test:coverage

# Expected output:
# ======= Coverage Summary =======
# Lines       : 92.3% (1000/1085)
# Functions   : 90.5% (45/49)
# Branches    : 88.2% (64/73)
# Statements  : 91.8% (950/1035)

# View HTML report
open coverage/index.html
```

#### Coverage Thresholds

```typescript
// vitest.config.ts - Enforce minimum coverage
coverage: {
  lines: 90,
  functions: 90,
  branches: 90,
  statements: 90,
  autoUpdate: false,  // Require explicit threshold updates
  perFile: true,      // Enforce per-file minimums
}
```

### 8. Continuous Testing Workflow

#### Development Mode

```bash
# Watch mode - runs tests on file changes
make client CMD="npm test -- --watch"

# Debug specific test
make client CMD="npx vitest run video.test.ts --reporter=verbose"

# Run with coverage in watch
make client CMD="npm test -- --coverage --watch"
```

#### CI/CD Integration

```bash
# Run full test suite (no watch)
make test

# Generate reports for CI
make test -- --reporter=json --reporter=html --coverage

# Fail on coverage drop
npm test -- --coverage --coverage.statements=90
```

### 9. Performance Benchmarks

```typescript
// tests/performance/core-metrics.test.ts
import { test, expect } from '@playwright/test';

test('should meet Core Web Vitals', async ({ page }) => {
  await page.goto('/dashboard');

  const metrics = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const lcp = performance.getEntriesByType('largest-contentful-paint').pop();

    return {
      fcp: fcp?.startTime || 0,
      lcp: lcp?.startTime || 0,
    };
  });

  expect(metrics.fcp).toBeLessThan(1500);  // FCP < 1.5s
  expect(metrics.lcp).toBeLessThan(2500);  // LCP < 2.5s
});
```

## See Also

- `patterns.md` - Advanced patterns and recipes
- `troubleshooting.md` - Common issues and solutions
- `examples/` - Real-world implementation examples
