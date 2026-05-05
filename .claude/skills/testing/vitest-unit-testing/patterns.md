# Vitest Unit Testing Patterns

## Advanced Testing Patterns and Recipes

### 1. Component Testing Patterns

#### Testing with Context Providers

```typescript
// renderWithProviders.ts - Reusable test utility
import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ThemeProvider } from '@/context/ThemeContext';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialTheme?: 'light' | 'dark';
}

export const renderWithProviders = (
  ui: ReactNode,
  { initialTheme = 'light', ...renderOptions }: RenderWithProvidersOptions = {}
) => {
  const testQueryClient = createTestQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      <ThemeProvider initialTheme={initialTheme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Usage in tests
it('should apply theme', () => {
  renderWithProviders(<Dashboard />, { initialTheme: 'dark' });
  expect(document.documentElement).toHaveClass('dark');
});
```

#### Testing Controlled Components

```typescript
describe('VideoUploadForm', () => {
  it('should update input value on change', async () => {
    const user = userEvent.setup();
    render(<VideoUploadForm onSubmit={vi.fn()} />);

    const input = screen.getByLabelText('Video URL');
    await user.type(input, 'https://youtube.com/watch?v=test');

    expect(input).toHaveValue('https://youtube.com/watch?v=test');
  });

  it('should validate URL format', async () => {
    const user = userEvent.setup();
    render(<VideoUploadForm onSubmit={vi.fn()} />);

    const input = screen.getByLabelText('Video URL');
    await user.type(input, 'invalid-url');

    expect(screen.getByText(/invalid URL format/i)).toBeInTheDocument();
  });

  it('should disable submit button when form invalid', async () => {
    render(<VideoUploadForm onSubmit={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /upload/i });
    expect(submitButton).toBeDisabled();

    const input = screen.getByLabelText('Video URL');
    await userEvent.type(input, 'https://youtube.com/watch?v=test');

    expect(submitButton).toBeEnabled();
  });
});
```

#### Testing Async Components

```typescript
describe('VideoList', () => {
  it('should display loading state initially', () => {
    vi.mocked(useVideoList).mockReturnValue({
      videos: [],
      isLoading: true,
      error: null,
    });

    render(<VideoList />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('should display videos when loaded', async () => {
    vi.mocked(useVideoList).mockReturnValue({
      videos: [mockVideo],
      isLoading: false,
      error: null,
    });

    render(<VideoList />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
  });

  it('should display error state', () => {
    vi.mocked(useVideoList).mockReturnValue({
      videos: [],
      isLoading: false,
      error: new Error('Failed to load'),
    });

    render(<VideoList />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
```

### 2. Hook Testing Patterns

#### Testing State Hooks

```typescript
describe('useLocalStorage', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('should persist value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
  });

  it('should sync across hook instances', () => {
    const { result: result1 } = renderHook(() => useLocalStorage('sync-key', 'value1'));
    const { result: result2 } = renderHook(() => useLocalStorage('sync-key', 'value1'));

    act(() => {
      result1.current[1]('synchronized');
    });

    expect(result2.current[0]).toBe('synchronized');
  });
});
```

#### Testing Data Fetching Hooks

```typescript
describe('useVideoList', () => {
  beforeEach(() => {
    mockVideoAPI.listen();
  });

  afterEach(() => {
    mockVideoAPI.close();
  });

  it('should fetch and return videos', async () => {
    mockVideoAPI.mockSuccess([mockVideo]);

    const { result } = renderHook(() => useVideoList());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.videos).toEqual([mockVideo]);
  });

  it('should handle API errors', async () => {
    mockVideoAPI.mockError(new Error('Network error'));

    const { result } = renderHook(() => useVideoList());

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.videos).toEqual([]);
  });

  it('should refetch on demand', async () => {
    mockVideoAPI.mockSuccess([mockVideo]);

    const { result } = renderHook(() => useVideoList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.refetch();
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockVideoAPI.getCallCount()).toBe(2);
  });
});
```

#### Testing Custom Hooks with Dependencies

```typescript
describe('useDebounce', () => {
  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } }
    );

    expect(result.current).toBe('a');

    // Update value multiple times
    rerender({ value: 'ab', delay: 500 });
    rerender({ value: 'abc', delay: 500 });
    rerender({ value: 'abcd', delay: 500 });

    // Value should not change immediately
    expect(result.current).toBe('a');

    // Wait for debounce
    await vi.advanceTimersByTimeAsync(500);

    expect(result.current).toBe('abcd');
  });
});
```

### 3. Mocking Patterns

#### Mocking Convex Functions

```typescript
// tests/fixtures/mockConvex.ts
import { vi } from 'vitest';

export const mockUseQuery = vi.fn();
export const mockUseMutation = vi.fn();

vi.mock('convex/react', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useConvex: vi.fn(),
}));

// Usage in tests
import { mockUseQuery, mockUseMutation } from '@/tests/fixtures/mockConvex';

it('should load videos from Convex', () => {
  mockUseQuery.mockReturnValue([mockVideo]);

  render(<VideoList />);

  expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
});

it('should handle Convex mutation', async () => {
  const user = userEvent.setup();
  const mockMutate = vi.fn();
  mockUseMutation.mockReturnValue({ mutate: mockMutate, isPending: false });

  render(<UploadForm />);

  await user.click(screen.getByRole('button', { name: /upload/i }));

  expect(mockMutate).toHaveBeenCalled();
});
```

#### Mocking External APIs

```typescript
// tests/fixtures/mockAPIs.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const mockYouTubeAPI = setupServer(
  http.get('*/youtube/api/*', () => {
    return HttpResponse.json({
      video: {
        title: 'Test Video',
        duration: 300,
        thumbnail: 'https://...',
      },
    });
  })
);

export const mockAssemblyAIAPI = setupServer(
  http.post('*/v2/transcript', () => {
    return HttpResponse.json({
      id: 'asr-123',
      status: 'processing',
    });
  })
);

// Usage
beforeEach(() => {
  mockYouTubeAPI.listen();
  mockAssemblyAIAPI.listen();
});

afterEach(() => {
  mockYouTubeAPI.close();
  mockAssemblyAIAPI.close();
});
```

#### Partial Mocking

```typescript
// Mock specific exports while keeping others real
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    fetchVideo: vi.fn(),  // Mock only this
  };
});

import { fetchVideo, deleteVideo } from '@/lib/api';

it('should use mocked fetchVideo', async () => {
  vi.mocked(fetchVideo).mockResolvedValue(mockVideo);

  const result = await fetchVideo('video-1');
  expect(result).toEqual(mockVideo);
});
```

### 4. Advanced Assertion Patterns

#### Custom Matchers

```typescript
// tests/setup/customMatchers.ts
import { expect } from 'vitest';

declare global {
  namespace Vi {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveValidYouTubeURL(): R;
    }
  }
}

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () =>
        `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass,
    };
  },

  toHaveValidYouTubeURL(received: string) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/;
    const pass = youtubeRegex.test(received);
    return {
      message: () => `expected "${received}" to be a valid YouTube URL`,
      pass,
    };
  },
});

// Usage
it('should have valid metrics', () => {
  expect(loadTime).toBeWithinRange(100, 500);
  expect(youtubeUrl).toHaveValidYouTubeURL();
});
```

#### Testing Error Boundaries

```typescript
describe('ErrorBoundary', () => {
  it('should catch and display error', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should display error details in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const ThrowError = () => {
      throw new Error('Test error message');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test error message')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});
```

### 5. Performance Testing Patterns

#### Testing Component Performance

```typescript
import { renderHook } from '@testing-library/react';
import { performance } from 'perf_hooks';

describe('VideoList Performance', () => {
  it('should render 1000 items in under 100ms', () => {
    const largeList = Array.from({ length: 1000 }, (_, i) => ({
      id: `video-${i}`,
      title: `Video ${i}`,
    }));

    const start = performance.now();
    render(<VideoList videos={largeList} />);
    const end = performance.now();

    expect(end - start).toBeLessThan(100);
  });

  it('should memoize component correctly', async () => {
    const { rerender } = render(
      <VideoList videos={[mockVideo]} onVideoClick={vi.fn()} />
    );

    const renderCount = vi.fn();

    // Rerender with same props
    rerender(
      <VideoList videos={[mockVideo]} onVideoClick={vi.fn()} />
    );

    // Memoization should prevent re-render
    // (verify with React DevTools Profiler)
  });
});
```

### 6. Snapshot Testing (Advanced)

#### Structural Snapshots Only

```typescript
// ✅ CORRECT - Snapshot stable structure
it('should render consistent button structure', () => {
  const { container } = render(
    <Button variant="primary" disabled={false}>
      Click me
    </Button>
  );

  expect(container.firstChild).toMatchSnapshot();
});

// ❌ WRONG - Snapshots with dynamic content
it('should render widget', () => {
  const { container } = render(
    <ComplexWidget data={apiResponse} timestamp={Date.now()} />
  );

  expect(container).toMatchSnapshot();  // Will fail on every run!
});

// ✅ BETTER - Test specific properties
it('renders button with correct classes', () => {
  render(<Button variant="primary">Click</Button>);
  const button = screen.getByRole('button');

  expect(button).toHaveClass('btn-primary', 'btn');
});
```

### 7. Test Utilities

#### Query Helpers

```typescript
// tests/utils/testHelpers.ts
export const getByTestId = (container: HTMLElement, testId: string) => {
  return container.querySelector(`[data-testid="${testId}"]`);
};

export const getAllByTestId = (container: HTMLElement, testId: string) => {
  return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`));
};

export const waitForElement = async (
  callback: () => HTMLElement | null,
  options = { timeout: 1000 }
) => {
  const startTime = Date.now();
  while (Date.now() - startTime < options.timeout) {
    const element = callback();
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Element not found within timeout');
};
```

#### Async Helpers

```typescript
export const waitForApi = async (mockFn: vi.Mock) => {
  await vi.waitFor(() => {
    expect(mockFn).toHaveBeenCalled();
  });
};

export const simulateNetworkDelay = async (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const mockConsoleError = () => {
  const originalError = console.error;
  console.error = vi.fn();

  return () => {
    console.error = originalError;
  };
};
```

## See Also

- `guide.md` - Complete implementation guide
- `troubleshooting.md` - Common issues and solutions
- `examples/` - Real-world test examples
