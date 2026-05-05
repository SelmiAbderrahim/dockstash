# Playwright E2E Testing Troubleshooting

## Common Issues and Solutions

### 1. Selector Issues

#### Problem: Element Selector Not Found

**Symptom**: `Error: Timeout waiting for locator`

```typescript
// ❌ WRONG - Brittle CSS selectors
const button = page.locator('.btn-primary');  // What if class changes?

// ✅ CORRECT - Use accessible selectors
const button = page.getByRole('button', { name: 'Submit' });
const input = page.getByLabel('Email');

// Debug: Check what's actually on page
await page.screenshot({ path: 'debug.png' });
console.log(await page.content()); // Print page HTML
```

#### Problem: Multiple Elements Match Selector

**Symptom**: Multiple elements matching selector, unclear which one to click

```typescript
// HTML: <button>Submit</button> appears twice on page

// ❌ WRONG - Ambiguous selector
await page.click('button:has-text("Submit")'); // Which one?

// ✅ CORRECT - Use more specific locator
const buttons = page.getByRole('button', { name: 'Submit' });
const firstButton = buttons.first();
const buttonInForm = page.locator('form').getByRole('button', { name: 'Submit' });

await firstButton.click();
```

#### Problem: Selector Works Locally But Not in CI

**Symptom**: Test passes locally but fails in CI environment

```typescript
// Common causes:
// 1. Timing differences (wait for element)
// ❌ WRONG - No wait
await page.click('button');

// ✅ CORRECT - Wait for element
await page.getByRole('button').waitFor({ state: 'visible' });
await page.getByRole('button').click();

// 2. Network conditions (slower in CI)
// ❌ WRONG - No network wait
await page.goto('/');

// ✅ CORRECT - Wait for network
await page.goto('/', { waitUntil: 'networkidle' });

// 3. Viewport differences
// Configure consistent viewport
playwright.config.ts:
use: {
  viewport: { width: 1920, height: 1080 }, // Set consistent size
},
```

### 2. Timing and Waiting Issues

#### Problem: Test Fails Intermittently (Flakiness)

**Symptom**: Same test passes sometimes, fails other times

```typescript
// ❌ WRONG - Hard-coded delays (flaky)
await page.click('button');
await new Promise(resolve => setTimeout(resolve, 2000)); // Arbitrary wait
expect(await page.textContent('h1')).toContain('Loaded');

// ✅ CORRECT - Wait for specific condition
await page.click('button');
await page.getByText('Loaded').waitFor({ state: 'visible' });
await expect(page.locator('h1')).toContainText('Loaded');

// ✅ BETTER - Use page.waitForFunction for complex conditions
await page.waitForFunction(() => {
  const element = document.querySelector('h1');
  return element?.textContent?.includes('Loaded');
});
```

#### Problem: Test Timeout

**Symptom**: `Timeout waiting for locator`, `Timeout waiting for navigation`

```typescript
// ❌ WRONG - Default timeout too short
await page.click('button');
await expect(page.getByText('Processing')).not.toBeVisible(); // Default 30s

// ✅ CORRECT - Increase timeout for long operations
await page.click('button');
await expect(page.getByText('Processing')).not.toBeVisible({ timeout: 120000 }); // 120s

// ✅ BETTER - Wait for loading state to complete
await page.click('button');
await page.getByText('Processing').waitFor({ state: 'visible' });
await page.getByText('Processing').waitFor({ state: 'hidden', timeout: 120000 });
```

#### Problem: Race Condition in Navigation

**Symptom**: Test fails because navigation happens before action completes

```typescript
// ❌ WRONG - Race condition
await page.click('button');
await page.waitForNavigation(); // May not trigger

// ✅ CORRECT - Promise.all to ensure both happen
await Promise.all([
  page.waitForNavigation(),
  page.click('button'),
]);

// ✅ CORRECT - Use waitForURL with action
await page.click('button');
await page.waitForURL('/dashboard');
```

### 3. Authentication Issues

#### Problem: Not Logged In During Tests

**Symptom**: Redirected to login on every test

```typescript
// ❌ WRONG - Login before each test (slow)
beforeEach(async ({ page }) => {
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');
  // + 2-3 seconds per test!
});

// ✅ CORRECT - Reuse authenticated state
test.beforeAll(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');

  // Save authenticated state
  await context.storageState({ path: 'auth.json' });
  await browser.close();
});

test.use({
  storageState: 'auth.json', // Reuse for all tests
});

test('user dashboard', async ({ page }) => {
  await page.goto('/dashboard'); // Already authenticated!
});
```

#### Problem: Session Expires During Test

**Symptom**: Test works for first part, fails when session times out

```typescript
// ✅ Prevent session timeout in tests
test.use({
  navigationTimeout: 30000,
  actionTimeout: 30000,
  timeout: 120000, // 2 minute test timeout
});

// ✅ Handle session expiration gracefully
await page.goto('/api-call');
try {
  await page.waitForNavigation({ timeout: 5000 });
} catch (error) {
  if (error.message.includes('401')) {
    // Re-authenticate
    await loginPage.login('user@example.com', 'password');
    // Retry operation
  }
}
```

### 4. Network and API Issues

#### Problem: API Mocking Not Working

**Symptom**: Test still calls real API despite route.abort()

```typescript
// ❌ WRONG - Route pattern too specific
await page.route('/api/videos', route => route.abort());
// API call to /api/v1/videos won't be intercepted

// ✅ CORRECT - Use wildcards
await page.route('**/api/videos**', route => route.abort());
await page.route('**/api/*', route => route.abort()); // Catch all API calls
```

#### Problem: Response Payload Incorrect

**Symptom**: Test gets wrong data from mocked API

```typescript
// ❌ WRONG - Incorrect response type
await page.route('**/api/videos', route => {
  route.respond({
    body: 'string body', // Wrong! API expects JSON
  });
});

// ✅ CORRECT - Return proper JSON
await page.route('**/api/videos', route => {
  route.respond({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: '1', title: 'Video' }]),
  });
});
```

#### Problem: Network Throttling Issues

**Symptom**: Performance test fails due to network variance

```typescript
// ✅ Consistent network conditions for tests
test.use({
  offline: false,
  slowMo: 0, // No artificial slowness
  launchArgs: ['--disable-blink-features=AutomationControlled'], // Hide headless mode
});

// ✅ Or simulate specific network
await context.route('**/*', route => {
  // Simulate 3G
  setTimeout(() => route.continue(), 100);
});
```

### 5. Visual Issues

#### Problem: Screenshot Comparison Fails

**Symptom**: Visual regression test fails on CI but passes locally

```typescript
// ❌ WRONG - Different screenshots each run
await expect(page).toHaveScreenshot('dashboard.png');
// Screenshot includes current time, user data, animations

// ✅ CORRECT - Mask dynamic content
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [
    page.locator('[data-test="timestamp"]'),
    page.locator('[data-test="user-avatar"]'),
  ],
});

// ✅ BETTER - Generate fresh baseline
npx playwright test --update-snapshots
// First run creates baseline, subsequent runs compare
```

#### Problem: Viewport Size Inconsistency

**Symptom**: Visual regression passes on different machines

```typescript
// ❌ WRONG - Default viewport varies
test('visual', async ({ page }) => {
  // Viewport might be 1920x1080 or 1280x720
});

// ✅ CORRECT - Set explicit viewport
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});

// Or in config:
playwright.config.ts:
use: {
  viewport: { width: 1920, height: 1080 }, // Consistent
},
```

### 6. Page Object Model Issues

#### Problem: Page Object Methods Timing Out

**Symptom**: Element not found in page object method

```typescript
// ❌ WRONG - No wait in page object
async clickUpload() {
  await this.page.click('[data-test="upload-button"]');
}

// ✅ CORRECT - Wait for element first
async clickUpload() {
  await this.uploadButton.waitFor({ state: 'visible' });
  await this.uploadButton.click();
}

// ✅ BETTER - Return meaningful result
async clickUpload() {
  const uploadButton = this.page.getByRole('button', { name: 'Upload' });
  await uploadButton.waitFor({ state: 'visible' });
  await uploadButton.click();
  await this.page.waitForURL('**/upload');
}
```

#### Problem: Locator Stale References

**Symptom**: `Error: Target page, context or browser has been closed`

```typescript
// ❌ WRONG - Saving locators outside class
const uploadButton = page.getByRole('button', { name: 'Upload' });

test('test 1', async () => {
  // Page navigates
  await uploadButton.click(); // Error! Context may be different
});

// ✅ CORRECT - Access locator through class method
class DashboardPage {
  private readonly uploadButton = () => this.page.getByRole('button', { name: 'Upload' });

  async clickUpload() {
    await this.uploadButton().click();
  }
}
```

### 7. Cross-Browser Issues

#### Problem: Works in Chrome, Fails in Firefox

**Symptom**: Test passes in chromium project, fails in firefox

```typescript
// Common causes:
// 1. CSS differences (Firefox renders slightly different)
// ✅ Use consistent styling
// ✅ Test on all browsers during development

// 2. Event handling differences
// ❌ WRONG - Assumes Chrome events
await page.click('button');
await page.keyboard.press('Enter'); // May not work in all browsers

// ✅ CORRECT - Use consistent interaction
await page.getByRole('button').click();

// 3. Timing differences
// ✅ Increase timeout for cross-browser
await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });
```

### 8. Debugging Techniques

#### Enable Debug Logging

```bash
# Run with debug output
PWDEBUG=1 npx playwright test

# Run in debug mode (opens inspector)
npx playwright test --debug

# Run with verbose output
npx playwright test --reporter=verbose

# Generate HTML report
npx playwright test --reporter=html
open playwright-report/index.html
```

#### Use page.pause()

```typescript
test('debug test', async ({ page }) => {
  await page.goto('/');

  // Execution pauses here
  // Browser stays open for inspection
  // Type commands in console
  await page.pause();

  // Can inspect elements
  const button = page.getByRole('button');
  console.log(await button.textContent());
});
```

#### Print Page Content

```typescript
// See what's actually rendered
const html = await page.content();
console.log(html);

// Or in a file
import fs from 'fs';
fs.writeFileSync('debug.html', html);

// Take screenshot with annotations
await page.screenshot({
  path: 'debug.png',
  fullPage: true,
});
```

### 9. CI/CD Specific Issues

#### Problem: Tests Pass Locally, Fail in CI

**Common causes**:
1. **Different environment variables** - `.env` file not loaded
2. **Timing differences** - CI servers slower
3. **Headless mode issues** - Chrome behaves differently
4. **Port conflicts** - Wrong port in CI

**Solutions**:

```typescript
// 1. Ensure env vars loaded
test.beforeAll(() => {
  expect(process.env.API_URL).toBeDefined();
});

// 2. Increase timeouts in CI
const timeout = process.env.CI ? 120000 : 30000;
test.setTimeout(timeout);

// 3. Use --no-sandbox for CI
playwright.config.ts:
webServer: {
  command: process.env.CI
    ? 'npm run dev -- --no-sandbox'
    : 'npm run dev',
},

// 4. Verify port availability
beforeAll(async () => {
  const response = await fetch('http://localhost:5173');
  expect(response.ok).toBe(true);
});
```

## See Also

- `guide.md` - Complete implementation guide
- `patterns.md` - Advanced patterns
- `SKILL.md` - Quick start reference
