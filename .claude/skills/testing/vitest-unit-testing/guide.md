# Vitest Unit Testing Guide

## Complete Implementation Guide

### 1. Mock Patterns

#### Function Mocks
```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue(data);
mockFn.mockRejectedValue(new Error('fail'));

// Verify calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(1);
```

#### Module Mocks
```typescript
// Mock entire module
vi.mock('@/lib/api', () => ({
  fetchVideo: vi.fn().mockResolvedValue({ id: '123', title: 'Test' })
}));

// Mock specific exports
import { fetchVideo } from '@/lib/api';
vi.mocked(fetchVideo).mockResolvedValue(mockData);
```

#### Module Constructor Mocks
```typescript
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => ({ data: mockData, isLoading: false })),
  useMutation: vi.fn(() => ({ mutate: vi.fn() })),
}));
```

### 2. Fixture Management

```typescript
// src/__tests__/fixtures/videos.ts
export const mockVideo = {
  _id: 'video-1',
  title: 'Test Video',
  duration: 300,
  status: 'completed' as const,
};

export const mockTranscript = {
  _id: 'transcript-1',
  videoId: 'video-1',
  text: 'This is the transcript...',
  segments: [],
};

// Usage in tests
import { mockVideo, mockTranscript } from '@/__tests__/fixtures/videos';

it('renders video metadata', () => {
  render(<VideoCard video={mockVideo} />);
  expect(screen.getByText('Test Video')).toBeInTheDocument();
});
```

### 3. Advanced Assertions

```typescript
// Custom matchers
expect(value).toBeWithinRange(10, 100);
expect(element).toHaveStyleRule('color', 'red');

// DOM assertions
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeDisabled();
expect(element).toHaveClass('active');
expect(element).toHaveAttribute('aria-label');

// Array/Object assertions
expect(arr).toContainEqual({ id: 1 });
expect(obj).toHaveProperty('name', 'John');

// Async assertions
expect(async () => {
  await api.call();
}).rejects.toThrow();
```

### 4. React Hooks Testing

```typescript
// src/hooks/__tests__/useVideoList.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVideoList } from '../useVideoList';

it('fetches and returns videos', async () => {
  const { result } = renderHook(() => useVideoList());

  // Initial state
  expect(result.current.videos).toEqual([]);
  expect(result.current.isLoading).toBe(true);

  // Wait for update
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  // Verify result
  expect(result.current.videos).toHaveLength(1);
});

it('allows refetch', async () => {
  const { result } = renderHook(() => useVideoList());

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  act(() => {
    result.current.refetch();
  });

  expect(result.current.isLoading).toBe(true);
});
```

### 5. Snapshot Testing (Use Sparingly)

```typescript
// Only for stable UI structures, not dynamic content
it('renders consistent UI', () => {
  const { container } = render(<Button>Click</Button>);
  expect(container).toMatchSnapshot();
});

// Better: Test specific properties
it('renders button with correct classes', () => {
  const { getByRole } = render(<Button variant="primary">Click</Button>);
  expect(getByRole('button')).toHaveClass('btn-primary');
});
```

### 6. Async Testing

```typescript
it('loads data asynchronously', async () => {
  const mockApi = vi.fn().mockResolvedValue({ id: 1, name: 'Video' });

  const { result } = renderHook(() => {
    const [data, setData] = useState(null);
    useEffect(() => {
      mockApi().then(setData);
    }, []);
    return data;
  });

  // Initially undefined
  expect(result.current).toBeNull();

  // Wait for update
  await waitFor(() => {
    expect(result.current).toEqual({ id: 1, name: 'Video' });
  });
});
```

### 7. Convex Testing

```typescript
// Test Convex mutations/queries
import { ConvexTestingHelper } from 'convex/testing';

const t = new ConvexTestingHelper();

it('should create video', async () => {
  const videoId = await t.mutation(api.videos.createVideo, {
    title: 'Test Video',
    url: 'https://youtube.com/watch?v=test',
  });

  expect(videoId).toBeDefined();

  const video = await t.query(api.videos.getVideo, { videoId });
  expect(video.title).toBe('Test Video');
});
```

### 8. Coverage Analysis

```bash
# Generate coverage report
npm run test:coverage

# Expected output:
# ✓ src/components/Button/Button.test.tsx
# ✓ src/hooks/useVideoList.test.ts
#
# Coverage Summary:
# Lines       : 92.3% (1000/1085)
# Functions   : 90.5% (45/49)
# Branches    : 88.2% (64/73)
# Statements  : 91.8% (950/1035)

# View HTML report
open coverage/index.html
```

## Best Practices

1. **One assertion focus per test**
2. **Use descriptive test names**
3. **Arrange-Act-Assert pattern**
4. **Mock external dependencies**
5. **Test behavior, not implementation**
6. **Keep tests maintainable**
7. **Use fixtures for complex data**
8. **Clear up side effects in cleanup**

## Common Pitfalls

❌ Testing implementation details
```typescript
// WRONG - testing internal state
expect(component.state.count).toBe(5);
```

✅ Testing user behavior
```typescript
// CORRECT - testing what user sees
expect(screen.getByText('Count: 5')).toBeInTheDocument();
```

---

❌ Not waiting for async updates
```typescript
// WRONG - assertion before data loads
render(<VideoList />);
expect(screen.getByText('Video')).toBeInTheDocument();
```

✅ Properly waiting for async
```typescript
// CORRECT - using waitFor
render(<VideoList />);
await waitFor(() => {
  expect(screen.getByText('Video')).toBeInTheDocument();
});
```

## See Also

- `patterns.md` - Advanced patterns and recipes
- `troubleshooting.md` - Common issues and solutions
- `examples/` - Real-world test examples
