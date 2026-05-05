# Playwright E2E Testing Patterns

## Advanced Testing Patterns and Recipes

### 1. Page Object Model Advanced Patterns

#### Base Page Class

```typescript
// tests/e2e/pages/BasePage.ts
import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly mainContent: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainContent = page.locator('main');
    this.loadingSpinner = page.locator('[data-testid="loading"]');
  }

  async goto(path: string) {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  async waitForNavigation(action: () => Promise<void>) {
    await Promise.all([
      this.page.waitForNavigation(),
      action(),
    ]);
  }

  async getPageTitle() {
    return this.page.title();
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }
}
```

#### Specialized Page Objects

```typescript
// tests/e2e/pages/LoginPage.ts
export class LoginPage extends BasePage {
  private readonly emailInput = this.page.getByLabel('Email');
  private readonly passwordInput = this.page.getByLabel('Password');
  private readonly loginButton = this.page.getByRole('button', { name: /log in/i });
  private readonly rememberMeCheckbox = this.page.getByLabel('Remember me');
  private readonly errorAlert = this.page.locator('[role="alert"]');
  private readonly forgotPasswordLink = this.page.getByRole('link', { name: /forgot/i });

  async goto() {
    await super.goto('/login');
    await expect(this.emailInput).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async loginAndWaitForRedirect(email: string, password: string, expectedPath: string) {
    await Promise.all([
      this.page.waitForURL(`**${expectedPath}`),
      this.login(email, password),
    ]);
  }

  async enableRememberMe() {
    await this.rememberMeCheckbox.check();
  }

  async isErrorVisible() {
    return this.errorAlert.isVisible();
  }

  async getErrorText() {
    return this.errorAlert.textContent();
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }
}

// tests/e2e/pages/DashboardPage.ts
export class DashboardPage extends BasePage {
  private readonly uploadButton = this.page.getByRole('button', { name: /upload/i });
  private readonly searchInput = this.page.getByPlaceholder('Search videos');
  private readonly videoCards = this.page.locator('[data-testid="video-card"]');
  private readonly sortDropdown = this.page.getByLabel('Sort by');
  private readonly userMenu = this.page.getByRole('button', { name: /profile/i });

  async clickUpload() {
    await this.uploadButton.click();
    await this.page.waitForURL('**/upload');
  }

  async searchVideos(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForLoadState('networkidle');
  }

  async getVideoCount() {
    return this.videoCards.count();
  }

  async getVideoTitles() {
    return this.videoCards.locator('h3').allTextContents();
  }

  async clickVideo(index: number) {
    await this.videoCards.nth(index).click();
    await this.page.waitForURL(/.*videos.*/);
  }

  async sortBy(option: string) {
    await this.sortDropdown.selectOption(option);
    await this.page.waitForLoadState('networkidle');
  }

  async openUserMenu() {
    await this.userMenu.click();
    await this.page.getByRole('menuitem').first().waitFor({ state: 'visible' });
  }

  async logout() {
    await this.openUserMenu();
    await this.page.getByRole('menuitem', { name: /logout/i }).click();
    await this.page.waitForURL('/login');
  }
}
```

### 2. Complex User Flow Patterns

#### Multi-Step User Journey

```typescript
// tests/e2e/flows/complete-video-upload-journey.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';
import { VideoDetailPage } from '../pages/VideoDetailPage';

test('complete video upload and transcription flow', async ({ page }) => {
  // 1. Login
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');

  // 2. Navigate to dashboard
  const dashboardPage = new DashboardPage(page);
  await expect(page).toHaveURL('/dashboard');
  const initialVideoCount = await dashboardPage.getVideoCount();

  // 3. Start upload
  await dashboardPage.clickUpload();

  // 4. Upload video
  const uploadPage = new UploadPage(page);
  await uploadPage.selectUploadMethod('youtube');
  await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  const videoTitle = 'My Test Video';
  await uploadPage.fillVideoTitle(videoTitle);
  await uploadPage.clickUploadButton();

  // 5. Wait for processing
  await page.waitForURL(/.*videos.*/, { timeout: 30000 });
  await expect(page.getByText(/processing|transcribing/i)).toBeVisible();

  // 6. View video details
  const videoDetailPage = new VideoDetailPage(page);
  await expect(page.locator('h1')).toContainText(videoTitle);

  // 7. Wait for transcription
  await videoDetailPage.waitForTranscriptionComplete({ timeout: 60000 });

  // 8. Search transcript
  const searchText = 'never gonna';
  await videoDetailPage.searchTranscript(searchText);
  await expect(page.getByText(searchText)).toBeVisible();

  // 9. Navigate to timestamp
  await videoDetailPage.clickSegmentAtTime(45);
  const currentTime = await videoDetailPage.getVideoCurrentTime();
  expect(Math.abs(currentTime - 45)).toBeLessThan(1);

  // 10. Return to dashboard and verify
  await dashboardPage.goto();
  const finalVideoCount = await dashboardPage.getVideoCount();
  expect(finalVideoCount).toBe(initialVideoCount + 1);
  expect(await dashboardPage.getVideoTitles()).toContain(videoTitle);
});
```

#### Parallel User Scenarios

```typescript
test('concurrent users uploading videos', async ({ browser }) => {
  // Create multiple browser contexts (simulating multiple users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  try {
    // User 1 logs in
    const loginPage1 = new LoginPage(page1);
    await loginPage1.goto();
    await loginPage1.login('user1@example.com', 'password123');

    // User 2 logs in
    const loginPage2 = new LoginPage(page2);
    await loginPage2.goto();
    await loginPage2.login('user2@example.com', 'password123');

    // Both upload simultaneously
    const dashboard1 = new DashboardPage(page1);
    const dashboard2 = new DashboardPage(page2);

    await Promise.all([
      dashboard1.clickUpload(),
      dashboard2.clickUpload(),
    ]);

    // Verify both uploads succeed
    await expect(page1).toHaveURL(/.*upload/);
    await expect(page2).toHaveURL(/.*upload/);
  } finally {
    await context1.close();
    await context2.close();
  }
});
```

### 3. Visual Regression Testing

#### Screenshot Comparison

```typescript
// tests/e2e/visual/dashboard-visual.spec.ts
import { test, expect } from '@playwright/test';

test('visual: dashboard layout', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Full page screenshot
  await expect(page).toHaveScreenshot('dashboard-full.png', {
    maxDiffPixels: 100,
    timeout: 5000,
  });
});

test('visual: button states', async ({ page }) => {
  await page.goto('/components');

  // Primary button
  await expect(page.locator('button.primary')).toHaveScreenshot(
    'button-primary.png'
  );

  // Disabled button
  await expect(page.locator('button:disabled')).toHaveScreenshot(
    'button-disabled.png'
  );

  // Hover state
  const button = page.locator('button.primary').first();
  await button.hover();
  await expect(button).toHaveScreenshot('button-hover.png');
});

test('visual: responsive layouts', async ({ browser }) => {
  // Test desktop
  let page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard-desktop.png');
  await page.close();

  // Test tablet
  page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard-tablet.png');
  await page.close();

  // Test mobile
  page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard-mobile.png');
  await page.close();
});
```

### 4. Accessibility Testing

#### WCAG Compliance Testing

```typescript
// tests/e2e/a11y/wcag-compliance.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test('should pass accessibility audit', async ({ page }) => {
  await page.goto('/dashboard');
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: {
      html: true,
    },
  });
});

test('should have proper heading hierarchy', async ({ page }) => {
  await page.goto('/dashboard');

  const h1Count = await page.locator('h1').count();
  const h2Count = await page.locator('h2').count();

  expect(h1Count).toBe(1); // Only one H1 per page
  expect(h2Count).toBeGreaterThan(0);
});

test('should have proper form labels', async ({ page }) => {
  await page.goto('/login');

  // All inputs should have associated labels
  const inputs = await page.locator('input').count();
  const labels = await page.locator('label').count();

  expect(labels).toBeGreaterThanOrEqual(inputs - 1); // Hidden inputs may not have labels
});

test('should have proper color contrast', async ({ page }) => {
  await page.goto('/dashboard');
  await injectAxe(page);

  await page.evaluate(() => {
    // Custom check for color contrast
    const elements = document.querySelectorAll('[style*="color"]');
    elements.forEach(el => {
      const styles = window.getComputedStyle(el);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;

      // Verify WCAG AA contrast (4.5:1 for text)
      // Implementation would use a contrast calculation library
    });
  });
});
```

#### Keyboard Navigation Testing

```typescript
// tests/e2e/a11y/keyboard-navigation.spec.ts
test('should navigate form with keyboard', async ({ page }) => {
  await page.goto('/login');

  // Tab to email input
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();

  // Type email
  await page.keyboard.type('user@example.com');

  // Tab to password input
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();

  // Type password
  await page.keyboard.type('password123');

  // Tab to submit button
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /log in/i })).toBeFocused();

  // Submit with Enter
  await page.keyboard.press('Enter');

  // Verify navigation
  await page.waitForURL('/dashboard');
});

test('should navigate menu with arrow keys', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /menu/i }).focus();

  // Open menu
  await page.keyboard.press('Enter');

  // Navigate menu items
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem').nth(0)).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem').nth(1)).toBeFocused();

  // Select with Enter
  await page.keyboard.press('Enter');
});
```

### 5. Error Handling and Recovery

#### Network Failure Testing

```typescript
// tests/e2e/error-handling/network-failures.spec.ts
test('should handle network timeout gracefully', async ({ page }) => {
  // Throttle network
  await page.route('**/*.json', route => {
    setTimeout(() => route.abort('timedout'), 10000);
  });

  await page.goto('/dashboard');

  // Should show error message
  await expect(page.getByText(/network error|failed to load/i)).toBeVisible();

  // Retry button should work
  await page.route('**/api/videos', route => route.continue());
  await page.getByRole('button', { name: /retry/i }).click();

  // Should load successfully
  await expect(page.getByText(/failed/i)).not.toBeVisible();
});

test('should handle API 5xx errors', async ({ page }) => {
  await page.route('**/api/videos', route => {
    route.abort('failed');
  });

  await page.goto('/dashboard');

  await expect(page.getByText(/error|try again/i)).toBeVisible();
  expect(page.getByRole('button', { name: /retry/i })).toBeDefined();
});

test('should handle 401 unauthorized', async ({ page }) => {
  await page.route('**/api/videos', route => {
    route.respond({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
  });

  await page.goto('/dashboard');

  // Should redirect to login
  await page.waitForURL('/login', { timeout: 5000 });
});
```

### 6. Performance Testing Integration

#### Load Time Metrics

```typescript
// tests/e2e/performance/load-metrics.spec.ts
test('should load dashboard within performance budget', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry;
    const lcp = performance.getEntriesByType('largest-contentful-paint').pop() as PerformanceEntry;

    return {
      navigationStart: navigation.navigationStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
      loadComplete: navigation.loadEventEnd - navigation.navigationStart,
      fcp: fcp?.startTime || 0,
      lcp: lcp?.startTime || 0,
    };
  });

  // Verify performance budgets
  expect(metrics.fcp).toBeLessThan(1500); // FCP < 1.5s
  expect(metrics.lcp).toBeLessThan(2500); // LCP < 2.5s
  expect(metrics.loadComplete).toBeLessThan(3000); // Load complete < 3s
});

test('should measure video list scroll performance', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const frameDrops = await page.evaluate(() => {
    let drops = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry as any).duration > 50) {
          drops++;
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });

    // Scroll
    window.scrollBy(0, window.innerHeight * 5);

    return drops;
  });

  expect(frameDrops).toBeLessThan(5); // Allow minimal frame drops
});
```

## See Also

- `guide.md` - Complete implementation guide
- `troubleshooting.md` - Common issues and solutions
- `examples/` - Real-world test examples
