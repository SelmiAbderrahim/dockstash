# Comprehensive Testing Strategy Troubleshooting

## Common Issues and Solutions Across All Testing Layers

### 1. Test Coverage Issues

#### Problem: High Coverage But Still Finding Bugs

**Symptom**: Coverage shows 95%+ but bugs appear in production

```typescript
// Root cause: Testing implementation, not behavior
// ❌ WRONG - Testing internals
it('should set loading state', () => {
  const { result } = renderHook(() => useVideoUpload());
  expect(result.current.isLoading).toBe(false); // Testing internal state!
});

// ✅ CORRECT - Testing observable behavior
it('should show loading spinner while uploading', async () => {
  render(<VideoUploadForm />);

  await userEvent.type(screen.getByLabelText('URL'), 'https://youtube.com/...');
  await userEvent.click(screen.getByRole('button', { name: 'Upload' }));

  expect(screen.getByRole('status')).toHaveTextContent('Uploading...');
});

// Solution: Focus on user-visible behavior, not implementation
// - Test what user sees and does
// - Test error states user can trigger
// - Test edge cases that affect UX
```

#### Problem: Coverage Plateau at 85%

**Symptom**: Easy to reach 85%, hard to go higher

**Analysis**:

```typescript
// Typical coverage breakdown:
// 0-70%: Easy - happy paths
// 70-85%: Moderate - error handling, edge cases
// 85-95%: Hard - rare conditions, internal states
// 95-100%: Very hard - unreachable code, impossible states

// Solution: Identify truly untestable code
// ✅ Skip unreachable branches
/* istanbul ignore next */ // Marks for coverage skip
if (process.env.NODE_ENV === 'impossible_value') {
  doSomething();
}

// ✅ Or refactor to eliminate unreachable code
// ✅ Test meaningful scenarios, not 100% coverage
// - Focus on 90%+ actual behavior coverage
// - Don't chase impossible 100%
// - Prioritize critical paths
```

### 2. Test Maintenance Issues

#### Problem: Tests Break on Minor Code Changes

**Symptom**: Every refactoring breaks 10+ tests

**Root cause**: Tests too tightly coupled to implementation

```typescript
// ❌ WRONG - Testing implementation details
it('should update component state', () => {
  const { result } = renderHook(() => {
    const [videos, setVideos] = useState([]);
    // Testing private implementation
  });
});

// ✅ CORRECT - Test user-visible behavior
it('should display video list', () => {
  render(<VideoList />);
  expect(screen.getByText('Video 1')).toBeInTheDocument();
});

// ✅ Solution: Use page objects and testing abstractions
class VideoListPage {
  async getVideoTitles() {
    return screen.getAllByRole('heading').map(h => h.textContent);
  }
}

// Tests reference the page object, not DOM structure
// When structure changes, only page object updates
```

#### Problem: Test Suite Running Slow

**Symptom**: Tests take >30 minutes to run

**Optimization strategy**:

```typescript
// 1. Identify slow tests
// --reporter=verbose shows duration
npm test -- --reporter=verbose

// 2. Profile heavy tests
it('slow test', async () => {
  console.time('render');
  render(<ComplexComponent />);
  console.timeEnd('render'); // Identify bottleneck
});

// 3. Optimize test data
// ❌ WRONG - Create heavy data per test
beforeEach(() => {
  const largeDataset = generateMillion Videos(); // 2 seconds per test!
});

// ✅ CORRECT - Use lightweight mocks
beforeEach(() => {
  mockAPI.mockResolvedValue([mockVideo]); // <1ms
});

// 4. Parallel execution
// vitest.config.ts
test: {
  threads: true, // Enable parallel
  maxThreads: 4,
  minThreads: 1,
}

// 5. Skip unnecessary tests
test.skip('slow integration (covered by E2E)', () => { ... });
```

### 3. Cross-Layer Testing Problems

#### Problem: Unit Tests Pass, Integration Fails

**Symptom**: All unit tests green, integration fails

```typescript
// Root cause: Mocks not matching reality

// ❌ WRONG - Unit test mocks incorrectly
const mockFetch = vi.fn().mockResolvedValue({
  data: { id: '1' }, // But real API returns { id: '1', status: 'processing' }
});

// Unit test passes with incomplete mock
// Integration test fails because real data structure different

// ✅ CORRECT - Base mocks on actual API response
const mockFetch = vi.fn().mockResolvedValue({
  id: '1',
  status: 'processing',
  createdAt: new Date(),
  // All fields from real API
});

// ✅ BETTER - Use shared test fixtures
// tests/fixtures/apiResponses.ts
export const MOCK_VIDEO_RESPONSE = {
  // Exact structure from API documentation
};

// Use in all tests (unit, integration, E2E)
mockAPI.mockResolvedValue(MOCK_VIDEO_RESPONSE);
```

#### Problem: Integration Tests Flaky

**Symptom**: Intermittent failures, race conditions

```typescript
// Root cause: Tests not properly synchronized

// ❌ WRONG - No synchronization
it('should display uploaded video', async () => {
  mockAPI.mockResolvedValue({ id: '1' });

  render(<VideoList />);

  expect(screen.getByText('Video')).toBeInTheDocument(); // May not exist yet!
});

// ✅ CORRECT - Wait for async updates
it('should display uploaded video', async () => {
  mockAPI.mockResolvedValue({ id: '1' });

  render(<VideoList />);

  await waitFor(() => {
    expect(screen.getByText('Video')).toBeInTheDocument();
  });
});

// ✅ BETTER - Test async flow explicitly
it('should display uploaded video', async () => {
  const user = userEvent.setup();
  render(<UploadFlow />);

  // User action triggers fetch
  await user.click(screen.getByRole('button', { name: 'Upload' }));

  // Wait for loading state
  expect(screen.getByRole('status')).toHaveTextContent('Uploading...');

  // Wait for completion
  await waitFor(() => {
    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
  });
});
```

### 4. E2E Testing Issues

#### Problem: E2E Tests Flaky and Slow

**Symptom**: 10-minute test suite, random failures

```typescript
// Root cause: Too many E2E tests, should be fewer

// ❌ WRONG - Testing everything in E2E
test('user registration', async ({ page }) => {
  // Fill form
  // Submit
  // Verify redirect
  // Check database
  // All covered by E2E - but should be unit/integration
});

test('validation errors', async ({ page }) => {
  // Test each field validation
  // Should be unit tests!
});

// ✅ CORRECT - Only critical user paths
test('complete registration flow', async ({ page }) => {
  // 1. Go to signup
  // 2. Fill valid data
  // 3. Verify success
  // Only happy path + one error scenario
});

test('login after registration', async ({ page }) => {
  // Verify user can login
  // Cross-feature flow
});

// ✅ Pyramid approach:
// Unit: Form validation (100+ tests) - <1s each
// Integration: API integration (20 tests) - <5s each
// E2E: Critical paths (5 tests) - <30s each
```

#### Problem: E2E Tests Can't Reproduce Bug

**Symptom**: Bug happens for users, E2E test can't recreate

```typescript
// Common reasons:
// 1. Test environment too clean (real data has 10 years of history)
// 2. Test user data different from real users
// 3. Network conditions unrealistic

// ✅ Solution: Add realistic data setup
test('should handle large dataset', async ({ page, context }) => {
  // Seed realistic data
  await seedTestData({
    videoCount: 1000,
    oldestDate: new Date('2010-01-01'),
    userHistory: true,
  });

  // Test with realistic conditions
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Should still perform well
  const metrics = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return (fcp as any)?.startTime || 0;
  });

  expect(metrics).toBeLessThan(2500);
});
```

### 5. Accessibility Testing Issues

#### Problem: Accessibility Tests Passing, But Site Not Accessible

**Symptom**: axe-core says no violations, but screen readers struggle

```typescript
// Root cause: Automated testing doesn't catch all issues

// Automated tests catch:
// ✅ Missing labels
// ✅ Missing alt text
// ✅ Color contrast
// ✅ ARIA attributes

// They DON'T catch:
// ❌ Logical tab order (must be tested manually)
// ❌ Screen reader announcements (must listen to screen reader)
// ❌ Touch/keyboard flow (requires manual navigation)

// ✅ Solution: Mix automated + manual testing
// Automated (Vitest + axe)
it('should pass accessibility audit', async () => {
  const { container } = render(<Form />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

// Keyboard navigation (Playwright)
test('should navigate form with keyboard', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();
});

// Screen reader testing (Manual or specialized tools)
// - Use NVDA, JAWS, or VoiceOver
// - Test actual announcements
// - Verify context and labels
```

### 6. Performance Testing Issues

#### Problem: Performance Tests Unreliable

**Symptom**: Same test gives different results each run

```typescript
// Root cause: System variance, network variance

// ❌ WRONG - Expecting exact performance
it('should load in exactly 1500ms', () => {
  const startTime = Date.now();
  // ...
  const duration = Date.now() - startTime;
  expect(duration).toBe(1500); // Too strict!
});

// ✅ CORRECT - Use realistic budgets
it('should load within performance budget', () => {
  const startTime = performance.now();
  // ...
  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(2500); // 2.5s budget
});

// ✅ BETTER - Multiple runs for statistical validity
it('should meet performance budget on average', async () => {
  const runs = [];

  for (let i = 0; i < 5; i++) {
    const startTime = performance.now();
    // ...
    runs.push(performance.now() - startTime);
  }

  const average = runs.reduce((a, b) => a + b) / runs.length;
  expect(average).toBeLessThan(2500);

  // Also check no single run is too slow
  const max = Math.max(...runs);
  expect(max).toBeLessThan(3500); // No outliers
});
```

### 7. Test Data Management

#### Problem: Tests Interfering With Each Other

**Symptom**: Tests pass individually, fail when run together

```typescript
// Root cause: Shared state between tests

// ❌ WRONG - Shared test data
let testVideo = { id: '1', title: 'Video' };

beforeEach(() => {
  // Doesn't reset testVideo state!
});

it('test 1', () => {
  testVideo.title = 'Updated'; // Modifies shared object
  expect(testVideo.title).toBe('Updated');
});

it('test 2', () => {
  expect(testVideo.title).toBe('Video'); // Fails! Modified by test 1
});

// ✅ CORRECT - Fresh data per test
const createTestVideo = () => ({
  id: '1',
  title: 'Video',
});

it('test 1', () => {
  const video = createTestVideo();
  video.title = 'Updated';
  expect(video.title).toBe('Updated');
});

it('test 2', () => {
  const video = createTestVideo(); // Fresh copy
  expect(video.title).toBe('Video'); // Passes!
});

// ✅ BETTER - Use fixtures for consistency
// tests/fixtures/testData.ts
export const createTestVideo = () => ({
  _id: 'video-test-1',
  title: 'Test Video',
  status: 'completed' as const,
  // ...all required fields
});
```

### 8. Debugging Strategy

#### Problem: Unclear Why Test Fails

**Diagnostic approach**:

```typescript
// 1. Get detailed error output
npm test -- --reporter=verbose 2>&1 | tee test-output.log

// 2. Check assertions
// What was expected vs what was found?
expect(actualValue).toBe(expectedValue);
// Output shows: Expected 'undefined' to be 'Video'

// 3. Check DOM state
screen.debug(); // Print entire DOM
screen.logTestingPlaygroundURL(); // Interactive debugging

// 4. Check mock calls
console.log(mockFn.mock.calls); // What arguments?
console.log(mockFn.mock.results); // What returned?

// 5. Add strategic logging
it('should update video', async () => {
  console.log('1. Rendering...');
  render(<VideoForm />);

  console.log('2. Filling form...');
  await userEvent.type(screen.getByLabelText('Title'), 'New Title');

  console.log('3. Submitting...');
  await userEvent.click(screen.getByRole('button'));

  console.log('4. Waiting for update...');
  await waitFor(() => {
    console.log('5. Checking result...');
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});

// 6. Isolate the problem
// Run just failing test:
npm test -- --testNamePattern="should update video"

// Or run in debug mode:
npm test -- --inspect-brk
```

## See Also

- `guide.md` - Complete implementation guide
- `patterns.md` - Advanced patterns
- `SKILL.md` - Quick start reference
