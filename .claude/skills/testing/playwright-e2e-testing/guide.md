# Playwright E2E Testing Guide

## Complete Implementation Guide

### 1. Project Setup

#### Installation

```bash
# Install Playwright and dependencies
make client CMD="npm install -D @playwright/test @testing-library/user-event"

# Install browsers (required for testing)
make client CMD="npx playwright install"

# Verify installation
make client CMD="npx playwright --version"
```

#### Configuration File

**playwright.config.ts**:

```typescript
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
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

### 2. Selectors and Locators

#### Best Practices for Selectors

```typescript
// ✅ CORRECT - Use accessible selectors
const loginButton = page.getByRole('button', { name: /log in/i });
const emailInput = page.getByLabel('Email');
const submitButton = page.getByRole('button', { type: 'submit' });

// ❌ WRONG - Brittle selectors
const button = page.locator('.btn-primary');
const input = page.locator('input[id*="email"]');
```

#### Selector Types

```typescript
// By role (most accessible)
page.getByRole('button', { name: 'Submit' });
page.getByRole('textbox', { name: 'Email' });
page.getByRole('heading', { level: 1 });

// By label text (form inputs)
page.getByLabel('Email Address');
page.getByLabel('Password');

// By placeholder
page.getByPlaceholder('Enter your email');

// By text (headings, buttons)
page.getByText('Welcome back');
page.getByText(/log in/i);

// By test ID (fallback)
page.getByTestId('submit-button');

// Locators (CSS/XPath as last resort)
page.locator('[data-test="video-card"]');
page.locator('//button[contains(text(), "Upload")]');
```

### 3. Navigation and Waiting

#### Page Navigation

```typescript
// Simple navigation
await page.goto('/');
await page.goto('/dashboard');

// Wait for navigation to complete
await page.goto('/videos', { waitUntil: 'networkidle' });

// Navigate without waiting
await page.goto('/heavy-page', { waitUntil: 'domcontentloaded' });

// Go back/forward in history
await page.goBack();
await page.goForward();
```

#### Waiting Strategies

```typescript
// Wait for element visibility
await page.locator('text=Upload complete').waitFor({ state: 'visible' });

// Wait for URL change
await page.waitForURL('/dashboard');

// Wait for function condition
await page.waitForFunction(() => {
  return document.querySelectorAll('[data-test="video-card"]').length > 0;
});

// Wait for navigation (after action)
const navigationPromise = page.waitForNavigation();
await page.click('button[type="submit"]');
await navigationPromise;

// Wait with timeout
await page.locator('.loading').waitFor({ state: 'hidden', timeout: 5000 });
```

### 4. User Interactions

#### Click and Input

```typescript
// Click button
await page.click('button[type="submit"]');
await page.getByRole('button', { name: 'Submit' }).click();

// Double click
await page.dblClick('canvas');

// Right click
await page.click('button', { button: 'right' });

// Fill input
await page.fill('input[name="email"]', 'user@example.com');
await page.getByLabel('Email').fill('user@example.com');

// Type (slower, simulates keystrokes)
await page.type('input[name="password"]', 'password123');

// Select option
await page.selectOption('select[name="language"]', 'en');

// Check/uncheck checkbox
await page.check('input[type="checkbox"]');
await page.uncheck('input[type="checkbox"]');
```

#### Form Submission

```typescript
test('should submit form', async ({ page }) => {
  await page.goto('/register');

  // Fill form
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('SecurePassword123!');

  // Submit
  await page.getByRole('button', { name: 'Register' }).click();

  // Wait for success
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Assertions

#### Page State Assertions

```typescript
// URL assertion
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveURL(/.*videos/);

// Title assertion
await expect(page).toHaveTitle('Dashboard');

// Text content
await expect(page.locator('h1')).toContainText('Welcome');
await expect(page.getByText('Loading')).not.toBeVisible();

// Element visibility
await expect(page.locator('.error')).toBeVisible();
await expect(page.locator('.spinner')).toBeHidden();

// Element state
await expect(page.getByRole('button')).toBeEnabled();
await expect(page.getByRole('button')).toBeDisabled();
await expect(page.getByRole('button')).toBeChecked();
await expect(page.getByRole('button')).not.toBeChecked();

// Element count
await expect(page.locator('[data-test="video-card"]')).toHaveCount(10);

// Attribute assertions
await expect(page.getByRole('img')).toHaveAttribute('alt', 'Thumbnail');
```

### 6. Page Object Model

#### Basic Page Object

```typescript
// tests/e2e/pages/BasePage.ts
import { Page } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
  }

  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }

  async getTitle() {
    return this.page.title();
  }
}
```

#### Login Page Object

```typescript
// tests/e2e/pages/LoginPage.ts
import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // Locators
  private readonly emailInput = this.page.getByLabel('Email');
  private readonly passwordInput = this.page.getByLabel('Password');
  private readonly loginButton = this.page.getByRole('button', { name: /log in/i });
  private readonly errorMessage = this.page.locator('[role="alert"]');

  async goto() {
    await super.goto('/login');
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  async loginAndNavigateToDashboard(email: string, password: string) {
    await this.login(email, password);
    await this.page.waitForURL('/dashboard');
  }

  async getErrorMessage() {
    return this.errorMessage.textContent();
  }

  async isErrorVisible() {
    return this.errorMessage.isVisible();
  }
}
```

#### Dashboard Page Object

```typescript
// tests/e2e/pages/DashboardPage.ts
export class DashboardPage extends BasePage {
  private readonly uploadButton = this.page.getByRole('button', { name: 'Upload Video' });
  private readonly videoCards = this.page.locator('[data-test="video-card"]');
  private readonly searchInput = this.page.getByPlaceholder('Search videos');

  async clickUploadButton() {
    await this.uploadButton.click();
  }

  async getVideoCount() {
    return this.videoCards.count();
  }

  async searchVideos(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForLoadState('networkidle');
  }

  async clickVideoByTitle(title: string) {
    await this.page.getByText(title, { exact: true }).click();
  }
}
```

### 7. User Flow Testing

#### Complete User Journey

```typescript
// tests/e2e/flows/complete-workflow.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';

test('complete user workflow', async ({ page }) => {
  // 1. Login
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');

  // 2. Dashboard
  const dashboardPage = new DashboardPage(page);
  await expect(page).toHaveURL('/dashboard');
  const initialCount = await dashboardPage.getVideoCount();

  // 3. Upload video
  await dashboardPage.clickUploadButton();
  const uploadPage = new UploadPage(page);
  await uploadPage.selectUploadMethod('youtube');
  await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await uploadPage.submitForm();

  // 4. Wait for processing
  await page.waitForURL(/.*videos.*/, { timeout: 30000 });
  await expect(page.getByText(/Processing|Completed/)).toBeVisible();

  // 5. Verify
  const finalCount = await dashboardPage.getVideoCount();
  expect(finalCount).toBe(initialCount + 1);
});
```

### 8. Visual Regression Testing

#### Screenshot Comparison

```typescript
test('visual regression - button states', async ({ page }) => {
  await page.goto('/components');

  // Compare against baseline
  await expect(page.locator('button.primary')).toHaveScreenshot('button-primary.png');
  await expect(page.locator('button.secondary')).toHaveScreenshot('button-secondary.png');
  await expect(page.locator('button:disabled')).toHaveScreenshot('button-disabled.png');
});

test('full page screenshot', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('dashboard-full.png', {
    mask: [page.locator('[data-test="user-avatar"]')], // Mask dynamic content
  });
});
```

### 9. Debugging

#### Debug Mode

```bash
# Run with Playwright Inspector
make client CMD="npx playwright test --debug"

# Run with headed browser (see browser)
make client CMD="npx playwright test --headed"

# Run specific test
make client CMD="npx playwright test video-upload.spec.ts"

# Run with verbose output
make client CMD="npx playwright test --reporter=verbose"
```

#### Debug in Test

```typescript
test('debug test', async ({ page }) => {
  await page.goto('/');

  // Pause execution
  await page.pause();

  // Log values
  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Take screenshot
  await page.screenshot({ path: 'debug-screenshot.png' });

  // Inspect element
  const locator = page.getByRole('button');
  console.log(await locator.textContent());
});
```

### 10. Performance Testing

#### Load Testing

```typescript
test('should load dashboard in under 3 seconds', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(3000);
});

test('should handle 100 video cards', async ({ page }) => {
  await page.goto('/dashboard');

  // Wait for all cards to render
  await page.waitForFunction(() => {
    return document.querySelectorAll('[data-test="video-card"]').length === 100;
  }, { timeout: 10000 });

  // Verify performance
  const metrics = await page.evaluate(() => {
    return {
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      lcp: performance.getEntriesByType('largest-contentful-paint').pop()?.startTime || 0,
    };
  });

  expect(metrics.fcp).toBeLessThan(1500);
  expect(metrics.lcp).toBeLessThan(2500);
});
```

## Best Practices

1. **Use Page Objects** - Maintainable, reusable, scalable
2. **Test user flows** - Not implementation details
3. **Use accessible selectors** - getByRole, getByLabel over CSS
4. **Wait for state** - Not arbitrary delays (no sleep!)
5. **Take screenshots** - On failure for debugging
6. **Run cross-browser** - Chrome, Firefox, Safari, Mobile
7. **Parallel execution** - Speed up test suite
8. **Handle flakiness** - Retries, proper waiting

## See Also

- `troubleshooting.md` - Common issues and solutions
- `patterns.md` - Advanced patterns and recipes
- `examples/` - Real-world test examples
