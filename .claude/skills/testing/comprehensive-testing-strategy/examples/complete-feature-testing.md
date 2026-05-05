# Complete Feature Testing Example

## Testing Pyramid for Video Upload Feature

This example demonstrates how to test a single feature across all three layers: Unit, Integration, and E2E.

### Feature: Video Upload with Validation and Status Updates

## Layer 1: Unit Tests (80% - Fast, Isolated)

### Test: Upload Form Component

```typescript
// src/components/VideoUploadForm/__tests__/VideoUploadForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoUploadForm } from '../VideoUploadForm';

describe('VideoUploadForm', () => {
  // Test 1: Rendering
  it('should render form with all fields', () => {
    render(<VideoUploadForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Video URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  // Test 2: URL Validation
  it('should show error for invalid URL', async () => {
    const user = userEvent.setup();
    render(<VideoUploadForm onSubmit={vi.fn()} />);

    const urlInput = screen.getByLabelText('Video URL');
    await user.type(urlInput, 'not-a-url');
    await user.type(screen.getByLabelText('Title'), 'Test');

    // Leave field to trigger validation
    fireEvent.blur(urlInput);

    expect(screen.getByText(/invalid.*url/i)).toBeInTheDocument();
  });

  // Test 3: Title Validation
  it('should show error when title is empty', async () => {
    const user = userEvent.setup();
    render(<VideoUploadForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(screen.getByText(/title.*required/i)).toBeInTheDocument();
  });

  // Test 4: Valid Submission
  it('should call onSubmit with valid data', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    render(<VideoUploadForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText('Video URL'), 'https://youtube.com/watch?v=test');
    await user.type(screen.getByLabelText('Title'), 'Test Video');
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(handleSubmit).toHaveBeenCalledWith({
      url: 'https://youtube.com/watch?v=test',
      title: 'Test Video',
    });
  });

  // Test 5: Disabled State
  it('should disable submit button while loading', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<VideoUploadForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText('Video URL'), 'https://youtube.com/watch?v=test');
    await user.type(screen.getByLabelText('Title'), 'Test Video');

    const submitButton = screen.getByRole('button', { name: /upload/i });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });

  // Test 6: Reset on Success
  it('should reset form after successful submission', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<VideoUploadForm onSubmit={handleSubmit} />);

    const urlInput = screen.getByLabelText('Video URL');
    const titleInput = screen.getByLabelText('Title');

    await user.type(urlInput, 'https://youtube.com/watch?v=test');
    await user.type(titleInput, 'Test Video');
    await user.click(screen.getByRole('button', { name: /upload/i }));

    // Wait for form to reset
    await vi.waitUntil(() => urlInput.value === '');

    expect(urlInput).toHaveValue('');
    expect(titleInput).toHaveValue('');
  });
});
```

**Coverage Metrics:**
- Lines: 95% (all form logic tested)
- Branches: 92% (validation paths, submission states)
- Functions: 100%
- Execution time: ~50ms

---

## Layer 2: Integration Tests (15% - Multi-Component, API)

### Test: Video Upload Workflow with API

```typescript
// src/features/VideoUpload/__tests__/VideoUploadWorkflow.integration.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { VideoUploadWorkflow } from '../VideoUploadWorkflow';

// Mock API
const mockServer = setupServer(
  http.post('*/api/videos', async ({ request }) => {
    const body = await request.json();

    // Validate request
    if (!body.url || !body.title) {
      return HttpResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Simulate processing
    return HttpResponse.json(
      {
        id: 'video-1',
        url: body.url,
        title: body.title,
        status: 'processing',
        createdAt: new Date(),
      },
      { status: 201 }
    );
  }),

  http.get('*/api/videos/:id', () => {
    return HttpResponse.json({
      id: 'video-1',
      status: 'completed',
      transcript: 'Test transcript content',
    });
  })
);

describe('Video Upload Workflow Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockServer.listen();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    mockServer.close();
    queryClient.clear();
  });

  // Test 1: Complete Upload Flow
  it('should complete full upload workflow', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <VideoUploadWorkflow />
      </QueryClientProvider>
    );

    // 1. Fill form
    await user.type(screen.getByLabelText('Video URL'), 'https://youtube.com/watch?v=test');
    await user.type(screen.getByLabelText('Title'), 'Integration Test Video');

    // 2. Submit
    await user.click(screen.getByRole('button', { name: /upload/i }));

    // 3. Verify loading state
    expect(screen.getByRole('status')).toHaveTextContent('Uploading...');

    // 4. Wait for success
    await waitFor(() => {
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    });

    // 5. Verify video appears in list
    expect(screen.getByText('Integration Test Video')).toBeInTheDocument();
  });

  // Test 2: Error Handling
  it('should handle API errors gracefully', async () => {
    mockServer.use(
      http.post('*/api/videos', () => {
        return HttpResponse.json(
          { error: 'Server error' },
          { status: 500 }
        );
      })
    );

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <VideoUploadWorkflow />
      </QueryClientProvider>
    );

    await user.type(screen.getByLabelText('Video URL'), 'https://youtube.com/watch?v=test');
    await user.type(screen.getByLabelText('Title'), 'Test Video');
    await user.click(screen.getByRole('button', { name: /upload/i }));

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
    });

    // Verify retry button
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // Test 3: Retry on Error
  it('should retry upload on user request', async () => {
    let callCount = 0;

    mockServer.use(
      http.post('*/api/videos', async () => {
        callCount++;

        if (callCount === 1) {
          return HttpResponse.json(
            { error: 'Server error' },
            { status: 500 }
          );
        }

        return HttpResponse.json(
          { id: 'video-1', status: 'processing' },
          { status: 201 }
        );
      })
    );

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <VideoUploadWorkflow />
      </QueryClientProvider>
    );

    // First attempt fails
    await user.type(screen.getByLabelText('Video URL'), 'https://youtube.com/watch?v=test');
    await user.type(screen.getByLabelText('Title'), 'Test Video');
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    // Retry succeeds
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    });

    expect(callCount).toBe(2);
  });

  // Test 4: Validation Integration
  it('should validate input before API call', async () => {
    const user = userEvent.setup();
    const apiSpy = vi.spyOn(global, 'fetch');

    render(
      <QueryClientProvider client={queryClient}>
        <VideoUploadWorkflow />
      </QueryClientProvider>
    );

    // Try to submit without filling title
    await user.type(screen.getByLabelText('Video URL'), 'https://youtube.com/watch?v=test');
    await user.click(screen.getByRole('button', { name: /upload/i }));

    // Verify API was NOT called
    expect(apiSpy).not.toHaveBeenCalled();

    // Verify validation error shown
    expect(screen.getByText(/title.*required/i)).toBeInTheDocument();
  });
});
```

**Coverage Metrics:**
- Covers form + API interaction
- Tests error scenarios
- Verifies state transitions
- Execution time: ~500ms

---

## Layer 3: E2E Tests (5% - Critical Paths Only)

### Test: Complete User Upload Journey

```typescript
// tests/e2e/flows/video-upload-complete.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';

test('complete video upload end-to-end', async ({ page }) => {
  // 1. Login
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');

  // 2. Navigate to dashboard
  const dashboardPage = new DashboardPage(page);
  await expect(page).toHaveURL('/dashboard');

  // 3. Start upload
  await dashboardPage.clickUpload();

  // 4. Upload video
  const uploadPage = new UploadPage(page);
  await uploadPage.selectUploadMethod('youtube');
  await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await uploadPage.fillVideoTitle('E2E Test Video');

  // 5. Verify submission
  await uploadPage.clickUploadButton();
  await expect(page).toHaveURL(/.*videos.*/);

  // 6. Verify success message
  await expect(page.getByText(/uploading|processing/i)).toBeVisible();
});
```

**Execution time:** ~15 seconds

---

## Test Coverage Summary

| Layer | Tests | Time | Focus |
|-------|-------|------|-------|
| Unit | 6 tests | 50ms | Form validation, state, events |
| Integration | 4 tests | 500ms | API calls, error handling, retries |
| E2E | 1 test | 15s | Critical happy path |

**Total Coverage:** 100% of critical code paths

---

## Running the Tests

```bash
# Run all tests
npm test

# Run by layer
npm run test:unit -- VideoUpload
npm run test:integration -- VideoUpload
npm run test:e2e -- video-upload

# Run with coverage
npm run test:coverage -- VideoUpload

# Expected coverage for this feature:
# Lines: 94% (10/11 - one deprecated branch)
# Functions: 100% (8/8)
# Branches: 91% (11/12)
# Statements: 94%
```

---

## Key Principles Demonstrated

1. **Test Isolation**: Each layer independent, can run separately
2. **DRY Fixtures**: Shared test data (URLs, credentials)
3. **Realistic Mocking**: API mocks match actual responses
4. **Error Coverage**: Happy path + main error scenarios
5. **Performance**: 50ms unit + 500ms integration + 15s E2E = lean suite
6. **Maintainability**: Page objects + fixtures + helpers
