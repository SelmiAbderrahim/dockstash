# Comprehensive Testing Strategy Patterns

## Advanced Testing Patterns Across All Layers

### 1. Cross-Layer Testing Patterns

#### Test Pyramid Implementation

```typescript
// 1. Unit Test - Component isolation (SHOULD EXIST)
// tests/unit/Button.test.tsx
describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click');
  });
});

// 2. Integration Test - Component + API (SHOULD EXIST)
// tests/integration/login.integration.test.tsx
describe('Login Integration', () => {
  it('should submit credentials and handle response', async () => {
    const { user } = renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });
  });
});

// 3. E2E Test - Complete user flow (MINIMAL SCOPE)
// tests/e2e/flows/login.spec.ts
test('user can login via UI', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');

  await expect(page).toHaveURL('/dashboard');
});
```

#### Test Data Consistency Across Layers

```typescript
// tests/fixtures/testData.ts - Single source of truth
export const TEST_USER = {
  email: 'test@example.com',
  password: 'SecurePassword123!',
  id: 'user-test-1',
  name: 'Test User',
};

export const TEST_VIDEO = {
  id: 'video-test-1',
  title: 'Test Video',
  url: 'https://www.youtube.com/watch?v=test123',
  duration: 300,
  status: 'completed' as const,
};

// Usage in unit tests
import { TEST_VIDEO } from '@/tests/fixtures/testData';

it('renders video', () => {
  render(<VideoCard video={TEST_VIDEO} />);
  expect(screen.getByText(TEST_VIDEO.title)).toBeInTheDocument();
});

// Usage in integration tests
it('uploads video', async () => {
  mockVideoAPI.mockSuccess(TEST_VIDEO);
  render(<UploadForm />);
  // ...
});

// Usage in E2E tests
test('displays user video', async ({ page }) => {
  await page.goto(`/videos/${TEST_VIDEO.id}`);
  await expect(page.getByText(TEST_VIDEO.title)).toBeVisible();
});
```

### 2. Coverage-Driven Testing Patterns

#### Mapping Coverage to Test Layers

```typescript
// Component with 80%+ coverage requirement
// src/components/VideoCard.tsx
export const VideoCard = ({ video, onPlay, onDelete }: VideoCardProps) => {
  // Branch 1: isLoading (unit test)
  if (video.status === 'processing') {
    return <div className="skeleton" />;
  }

  // Branch 2: error state (unit test)
  if (video.status === 'failed') {
    return <div role="alert">Failed to load</div>;
  }

  // Branch 3: normal rendering (unit test)
  return (
    <div>
      <h3>{video.title}</h3>
      <button onClick={() => onPlay(video.id)}>Play</button>
      <button onClick={() => onDelete(video.id)}>Delete</button>
    </div>
  );
};

// Unit tests covering all branches
describe('VideoCard Coverage', () => {
  it('renders loading state', () => {
    render(<VideoCard video={{ ...mockVideo, status: 'processing' }} />);
    expect(screen.getByRole('status')).toHaveClass('skeleton');
  }); // +1 branch

  it('renders error state', () => {
    render(<VideoCard video={{ ...mockVideo, status: 'failed' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  }); // +1 branch

  it('renders normal state', () => {
    render(<VideoCard video={mockVideo} onPlay={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
  }); // +1 branch

  it('calls onPlay callback', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<VideoCard video={mockVideo} onPlay={onPlay} />);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(onPlay).toHaveBeenCalledWith(mockVideo.id);
  }); // +1 branch

  it('calls onDelete callback', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<VideoCard video={mockVideo} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(mockVideo.id);
  }); // +1 branch
});
// Total coverage: 5 branches / 5 possible = 100%
```

### 3. Test Organization Patterns

#### Feature-Based Test Organization

```
features/
├── authentication/
│   ├── login/
│   │   ├── __tests__/
│   │   │   ├── LoginForm.test.tsx           # Unit: form validation
│   │   │   └── login.integration.test.tsx   # Integration: API interaction
│   │   │
│   │   └── LoginForm.tsx
│   │
│   └── signup/
│       └── ...
│
├── video-management/
│   ├── upload/
│   │   ├── __tests__/
│   │   │   ├── UploadForm.test.tsx          # Unit: form behavior
│   │   │   ├── upload.integration.test.tsx  # Integration: API + state
│   │   │   └── upload-flow.spec.ts          # E2E: complete user flow
│   │   │
│   │   └── UploadForm.tsx
│   │
│   └── view/
│       └── ...
│
tests/
├── e2e/flows/
│   └── complete-workflow.spec.ts
├── fixtures/
└── setup/
```

### 4. Testing Error Scenarios

#### Comprehensive Error Test Matrix

```typescript
// Error scenario coverage matrix
describe('Video Upload Error Handling', () => {
  // Validation errors (client-side)
  describe('Validation Errors', () => {
    it('should show error for missing video title', async () => {
      render(<UploadForm />);
      await fireEvent.click(screen.getByRole('button', { name: /upload/i }));

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });

    it('should show error for invalid YouTube URL', async () => {
      const user = userEvent.setup();
      render(<UploadForm />);

      const urlInput = screen.getByLabelText('YouTube URL');
      await user.type(urlInput, 'not-a-url');

      expect(screen.getByText(/invalid URL/i)).toBeInTheDocument();
    });
  });

  // System errors (service configuration)
  describe('System Errors', () => {
    it('should show error when API not configured', async () => {
      mockVideoAPI.mockError('SERVICE_NOT_CONFIGURED');

      render(<UploadForm />);
      // ... fill form and submit

      await waitFor(() => {
        expect(screen.getByText(/contact support/i)).toBeInTheDocument();
      });
    });
  });

  // Transient errors (network issues)
  describe('Transient Errors', () => {
    it('should retry on network timeout', async () => {
      mockVideoAPI.mockRejectedValueOnce(new Error('Timeout'));
      mockVideoAPI.mockResolvedValueOnce({ id: 'video-1' });

      render(<UploadForm />);
      // ... fill form and submit

      await waitFor(() => {
        expect(mockVideoAPI).toHaveBeenCalledTimes(2); // Initial + retry
      });
    });
  });

  // Rate limiting
  describe('Rate Limiting', () => {
    it('should show countdown timer on rate limit', async () => {
      mockVideoAPI.mockError('RATE_LIMIT_ERROR');

      render(<UploadForm />);
      // ... fill form and submit

      expect(screen.getByText(/try again in \d+s/i)).toBeInTheDocument();

      const button = screen.getByRole('button', { name: /upload/i });
      expect(button).toBeDisabled();
    });
  });
});
```

### 5. State Management Testing Patterns

#### Testing Convex Integration

```typescript
// Complete flow from component to Convex
describe('Video State Management', () => {
  it('should update video status through complete flow', async () => {
    // 1. Unit: Hook tests
    const { result } = renderHook(() => useVideoUpload());

    expect(result.current.status).toBe('idle');

    // 2. Act: Trigger upload
    act(() => {
      result.current.upload({ title: 'Test', url: 'https://youtube.com/...' });
    });

    expect(result.current.status).toBe('uploading');

    // 3. Wait for mutation
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    // 4. Integration: Test with Convex
    const { result: convexResult } = renderHook(
      () => useQuery(api.videos.getVideo, { id: result.current.videoId }),
      { wrapper: ConvexProvider }
    );

    expect(convexResult.current).toEqual(
      expect.objectContaining({ status: 'completed' })
    );

    // 5. E2E: Test UI reflects state
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDetail videoId={result.current.videoId} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Upload Complete')).toBeInTheDocument();
    });
  });
});
```

### 6. Performance Regression Testing

#### Automated Performance Monitoring

```typescript
// tests/performance/regression.test.ts
describe('Performance Regressions', () => {
  // Unit test performance
  it('should render 1000 items in under 100ms', () => {
    const largeList = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      title: `Item ${i}`,
    }));

    const start = performance.now();
    render(<VirtualizedList items={largeList} />);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  // Integration test performance
  it('should load 100 videos with API in under 2 seconds', async () => {
    mockVideoAPI.mockSuccess(
      Array.from({ length: 100 }, (_, i) => ({
        id: `video-${i}`,
        title: `Video ${i}`,
      }))
    );

    const start = performance.now();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoList />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Video 0')).toBeInTheDocument();
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(2000);
  });

  // E2E performance
  it('should load dashboard with Core Web Vitals passing', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const lcp = performance.getEntriesByType('largest-contentful-paint').pop();

      return {
        fcp: (fcp as any)?.startTime || 0,
        lcp: (lcp as any)?.startTime || 0,
      };
    });

    expect(metrics.fcp).toBeLessThan(1500);
    expect(metrics.lcp).toBeLessThan(2500);
  });
});
```

### 7. Accessibility Testing Across Layers

#### Comprehensive a11y Coverage

```typescript
describe('Accessibility Coverage', () => {
  // Unit: Component a11y
  describe('Unit: VideoCard a11y', () => {
    it('should have semantic HTML', () => {
      render(<VideoCard video={mockVideo} />);

      // Check semantic structure
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    it('should pass axe audit', async () => {
      const { container } = render(<VideoCard video={mockVideo} />);
      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });
  });

  // Integration: Form a11y
  describe('Integration: Form a11y', () => {
    it('should have proper labels and associations', () => {
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should announce form errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.click(screen.getByRole('button', { name: /log in/i }));

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/required/i);
    });
  });

  // E2E: Complete flow a11y
  describe('E2E: Complete flow a11y', () => {
    it('should navigate dashboard with keyboard only', async ({ page }) => {
      await page.goto('/dashboard');

      // Tab through all interactive elements
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      // Should be able to reach all buttons
      let tabCount = 0;
      while (tabCount < 20) {
        await page.keyboard.press('Tab');
        tabCount++;
      }

      // Verify all focusable elements are reachable
      const focusableElements = await page.locator('[tabindex], button, a, input').count();
      expect(tabCount).toBeGreaterThanOrEqual(focusableElements - 1);
    });
  });
});
```

### 8. Test Maintenance Patterns

#### Keeping Tests DRY

```typescript
// ❌ WRONG - Repetitive test setup
describe('Videos', () => {
  it('should list videos', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoList />
      </QueryClientProvider>
    );
    // ...
  });

  it('should filter videos', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoList />
      </QueryClientProvider>
    );
    // ...
  });
});

// ✅ CORRECT - Reusable setup utilities
const renderVideoList = () => {
  return renderWithProviders(<VideoList />);
};

describe('Videos', () => {
  it('should list videos', () => {
    renderVideoList();
    // ...
  });

  it('should filter videos', () => {
    renderVideoList();
    // ...
  });
});

// ✅ BETTER - Factory pattern for complex setups
interface VideoListTestSetup {
  render: () => RenderResult;
  user: UserEvent;
  mockAPI: typeof mockVideoAPI;
}

const setupVideoListTest = (): VideoListTestSetup => {
  const user = userEvent.setup();
  const mockAPI = vi.mocked(useVideoList);

  return {
    render: () => renderWithProviders(<VideoList />),
    user,
    mockAPI,
  };
};

describe('Videos', () => {
  it('should list videos', async () => {
    const { render, mockAPI } = setupVideoListTest();
    mockAPI.mockResolvedValue([mockVideo]);

    render();
    // ...
  });
});
```

## See Also

- `guide.md` - Complete implementation guide
- `troubleshooting.md` - Common issues and solutions
- `examples/` - Real-world test examples
