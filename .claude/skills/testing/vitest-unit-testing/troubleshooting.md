# Vitest Unit Testing Troubleshooting

## Common Issues and Solutions

### 1. Coverage Issues

#### Problem: Coverage Below 90%

**Symptom**: Test suite passes but coverage report shows <90% for lines/branches

```bash
# Check coverage report
npm run test:coverage

# Output shows:
# Lines: 85.2% (below 90%)
# Branches: 82.1% (below 90%)
```

**Root Causes**:
- Untested conditional branches
- Untested error paths
- Untested async edge cases
- Mock setup missing

**Solution**:

```typescript
// 1. Identify uncovered lines
// Check coverage/index.html for red (uncovered) lines

// 2. Add missing test cases
describe('VideoUpload', () => {
  it('should handle network error', async () => {
    // This error path may not be tested
    mockAPI.mockRejectedValue(new Error('Network error'));
    render(<UploadForm />);

    await userEvent.click(screen.getByRole('button'));

    // Now this error state is covered
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('should handle validation error', () => {
    // This branch may be untested
    render(<UploadForm />);

    // Submit without filling required fields
    fireEvent.submit(screen.getByRole('button'));

    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });
});

// 3. Force inline coverage updates
npm run test:coverage -- --coverage.perFile true --coverage.lines 90 --coverage.branches 90
```

#### Problem: Coverage Report Doesn't Update

**Symptom**: Coverage report shows old results even after adding tests

**Solution**:

```bash
# 1. Clear coverage cache
rm -rf coverage/

# 2. Run tests with fresh coverage
npm run test:coverage

# 3. Force coverage collection
npm test -- --coverage --no-coverage-cache

# 4. Verify in watch mode
npm test -- --watch --coverage
```

### 2. Mock Issues

#### Problem: Mock Not Working

**Symptom**: Mock function called but test fails, `mockFn.mock.calls` is empty

```typescript
// ❌ WRONG - Mock not set up properly
import { fetchVideo } from '@/lib/api';

vi.mock('@/lib/api'); // This alone doesn't mock!

it('should call API', async () => {
  render(<VideoList />);
  // fetchVideo not actually mocked
  expect(fetchVideo).toHaveBeenCalled(); // Fails!
});

// ✅ CORRECT - Explicitly set up mock return value
vi.mock('@/lib/api', () => ({
  fetchVideo: vi.fn().mockResolvedValue({ id: '1', title: 'Test' }),
}));

import { fetchVideo } from '@/lib/api';

it('should call API', async () => {
  const mockFetch = vi.mocked(fetchVideo);
  render(<VideoList />);

  expect(mockFetch).toHaveBeenCalled();
});
```

#### Problem: Module Mock Not Intercepting Calls

**Symptom**: API calls still reaching real endpoint despite mock setup

**Solution**:

```typescript
// Problem: Mock set up after import
import { fetchVideo } from '@/lib/api'; // Imports real function first!

vi.mock('@/lib/api', () => ({
  fetchVideo: vi.fn(),
})); // Too late, import already happened

// ✅ CORRECT - Mock must be set up before import
vi.mock('@/lib/api', () => ({
  fetchVideo: vi.fn().mockResolvedValue({ id: '1' }),
}));

import { fetchVideo } from '@/lib/api'; // Now imports mock

it('should use mocked API', async () => {
  expect(vi.mocked(fetchVideo)).toBeDefined();
});
```

#### Problem: Mock Reset Not Clearing Between Tests

**Symptom**: Mock state carries over between test cases

```typescript
// ❌ WRONG - Mock state persists
const mockFetch = vi.fn();

it('test 1', () => {
  mockFetch.mockResolvedValue({ data: 1 });
  mockFetch();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('test 2', () => {
  mockFetch(); // This is call #2, not #1!
  expect(mockFetch).toHaveBeenCalledTimes(1); // Fails!
});

// ✅ CORRECT - Reset in beforeEach
beforeEach(() => {
  mockFetch.mockClear(); // Or use mockReset() for full reset
});

it('test 1', () => {
  mockFetch.mockResolvedValue({ data: 1 });
  mockFetch();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('test 2', () => {
  mockFetch(); // This is call #1 (mock was cleared)
  expect(mockFetch).toHaveBeenCalledTimes(1); // Passes!
});
```

### 3. Async Testing Issues

#### Problem: Assertion Executes Before Async Completes

**Symptom**: Test fails intermittently or assertion runs before data loads

```typescript
// ❌ WRONG - No wait for async
it('should load videos', async () => {
  render(<VideoList />);
  expect(screen.getByText('Video 1')).toBeInTheDocument(); // Fails! Not loaded yet
});

// ✅ CORRECT - Use waitFor
it('should load videos', async () => {
  render(<VideoList />);

  await waitFor(() => {
    expect(screen.getByText('Video 1')).toBeInTheDocument();
  });
});

// ✅ CORRECT - Use findBy
it('should load videos', async () => {
  render(<VideoList />);

  expect(await screen.findByText('Video 1')).toBeInTheDocument();
});
```

#### Problem: Timeout Waiting for Async

**Symptom**: Test times out waiting for element

```typescript
// ❌ WRONG - Timeout too short
it('should load videos', async () => {
  render(<VideoList />);

  await waitFor(() => {
    expect(screen.getByText('Video 1')).toBeInTheDocument();
  }, { timeout: 100 }); // Only 100ms!
});

// ✅ CORRECT - Reasonable timeout
it('should load videos', async () => {
  render(<VideoList />);

  await waitFor(() => {
    expect(screen.getByText('Video 1')).toBeInTheDocument();
  }, { timeout: 3000 }); // 3 seconds
});

// ✅ BETTER - Debug timeout issues
it('should load videos', async () => {
  render(<VideoList />);

  try {
    await waitFor(() => {
      expect(screen.getByText('Video 1')).toBeInTheDocument();
    }, { timeout: 3000 });
  } catch (error) {
    // Debug: print what's actually rendered
    console.log(document.body.innerHTML);
    throw error;
  }
});
```

### 4. DOM Testing Issues

#### Problem: `getByText` Fails with Whitespace

**Symptom**: Element exists but `getByText` can't find it

```typescript
// HTML: <button>  Click  me  </button>

// ❌ WRONG - Exact match fails due to whitespace
expect(screen.getByText('Click me')).toBeInTheDocument(); // Fails!

// ✅ CORRECT - Use regex with /i for case insensitive
expect(screen.getByText(/click me/i)).toBeInTheDocument(); // Passes!

// ✅ CORRECT - Use getByRole (preferred)
expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
```

#### Problem: Multiple Matching Elements

**Symptom**: Multiple elements match selector

```typescript
// HTML:
// <button>Delete</button>
// <button>Delete</button>
// <button>Delete</button>

// ❌ WRONG - getByText fails with multiple matches
expect(screen.getByText('Delete')).toBeInTheDocument(); // Error: Multiple matches!

// ✅ CORRECT - Use getByRole with more specificity
expect(screen.getByRole('button', { name: 'Delete' })).toHaveCount(3);

// ✅ CORRECT - Use queryAllByText for multiple elements
const deleteButtons = screen.queryAllByText('Delete');
expect(deleteButtons).toHaveLength(3);
```

#### Problem: Element Not in Document

**Symptom**: "Unable to find an element" error

```typescript
// ❌ WRONG - Element not rendered
it('should show error', () => {
  const { container } = render(<Form onSubmit={vi.fn()} />);

  expect(screen.getByText('Error')).toBeInTheDocument(); // Fails! Not rendered
});

// ✅ CORRECT - Verify element should exist first
it('should show error', () => {
  render(<Form onSubmit={vi.fn()} />);

  // Use queryBy instead of getBy (returns null if not found)
  expect(screen.queryByText('Error')).not.toBeInTheDocument();

  // Trigger error state
  fireEvent.submit(screen.getByRole('button'));

  // Now it should exist
  expect(screen.getByText('Error')).toBeInTheDocument();
});
```

### 5. Hook Testing Issues

#### Problem: "Not wrapped in act()" Warning

**Symptom**: Warning during hook test execution

```typescript
// ❌ WRONG - State update not wrapped in act
it('should update state', () => {
  const { result } = renderHook(() => useState(0));

  result.current[1](1); // Warning: Not wrapped in act()!
});

// ✅ CORRECT - Wrap in act()
it('should update state', () => {
  const { result } = renderHook(() => useState(0));

  act(() => {
    result.current[1](1); // Wrapped in act()
  });

  expect(result.current[0]).toBe(1);
});
```

#### Problem: Hook Dependency Changes Not Detected

**Symptom**: Hook doesn't re-run when dependency changes

```typescript
// ❌ WRONG - Not using rerender for dependency changes
const { result } = renderHook(
  ({ value }) => useEffect(() => {
    // This should re-run when value changes
  }, [value]),
  { initialProps: { value: 1 } }
);

// value never actually changes
expect(result.current). // ...

// ✅ CORRECT - Use rerender to change props
const { result, rerender } = renderHook(
  ({ value }: { value: number }) => useMyHook(value),
  { initialProps: { value: 1 } }
);

rerender({ value: 2 }); // Now dependency changes
await waitFor(() => {
  expect(result.current).toBe(2);
});
```

### 6. Configuration Issues

#### Problem: jsdom Environment Not Set Up

**Symptom**: DOM methods undefined (`querySelector`, etc.)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom', // Must be set!
    globals: true,
  },
});

// If missing: window, document are undefined
// ✅ Add environment: 'jsdom' to config
```

#### Problem: TypeScript Types Not Recognized

**Symptom**: `toBeInTheDocument()` shows type error

```typescript
// ❌ WRONG - Missing types setup
// src/vitest.setup.ts not imported in config

// ✅ CORRECT - Configure in vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'], // Add this
  },
});

// vitest.setup.ts
import '@testing-library/jest-dom'; // Adds custom matchers
```

### 7. Debugging Techniques

#### Enable Debug Output

```typescript
import { render, screen } from '@testing-library/react';

it('should render form', () => {
  render(<LoginForm />);

  // Print DOM tree
  screen.debug();

  // Print specific element
  screen.debug(screen.getByRole('form'));

  // Alternative: logTestingPlaygroundURL
  screen.logTestingPlaygroundURL();
});
```

#### Use Testing Playground

```bash
# Run test with open browser debugging
npm test -- --inspector-brk

# In test, print URL for interactive debugging
screen.logTestingPlaygroundURL();

# Paste URL in browser to inspect elements interactively
```

#### Common Debug Commands

```typescript
// Get current DOM
console.log(document.body.innerHTML);

// Check what queries find
console.log(screen.getAllByRole('button'));
console.log(screen.queryAllByText(/test/));

// Verify mock calls
console.log(mockFn.mock.calls);
console.log(mockFn.mock.results);

// Check hook state
const { result } = renderHook(() => useMyHook());
console.log(result.current);
```

### 8. Performance Issues

#### Problem: Tests Running Slow

**Symptom**: Test suite takes >10 seconds

**Solutions**:

```typescript
// 1. Use beforeAll instead of beforeEach where possible
describe('Tests', () => {
  let setupData: any;

  beforeAll(() => {
    // Expensive setup
    setupData = createTestData(); // Once for all tests
  });

  beforeEach(() => {
    // Per-test setup (reset state, not creation)
  });
});

// 2. Remove unnecessary waits
// ❌ WRONG - Arbitrary delays
await new Promise(resolve => setTimeout(resolve, 1000));

// ✅ CORRECT - Wait for specific conditions
await waitFor(() => {
  expect(element).toBeInTheDocument();
});

// 3. Mock expensive operations
vi.mock('@/lib/expensiveAPI', () => ({
  expensiveOperation: vi.fn().mockResolvedValue({ data: [] }),
}));

// 4. Disable animations in tests
beforeAll(() => {
  document.documentElement.style.animationDuration = '0s';
});
```

## See Also

- `guide.md` - Complete implementation guide
- `patterns.md` - Advanced patterns
- `SKILL.md` - Quick start reference
