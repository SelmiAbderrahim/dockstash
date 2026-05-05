---
name: playwright-e2e-testing
description: >
  Playwright end-to-end testing patterns including Page Object Model, cross-browser testing, visual regression, and debugging.
---

# Playwright E2E Testing Skill

## Quick Start

**Purpose**: Master Playwright for comprehensive end-to-end testing across browsers

**Key Concepts**:
- Page Object Model pattern
- Cross-browser testing
- Visual regression testing
- Debugging and troubleshooting

## Installation

```bash
# In Docker container
make client CMD="npm install -D @playwright/test"

# Install browsers
make client CMD="npx playwright install"
```

## Basic E2E Test

```typescript
// tests/e2e/flows/login.spec.ts
import { test, expect } from '@playwright/test';

test('should login successfully', async ({ page }) => {
  await page.goto('/login');

  await page.fill('input[name="email"]', 'user@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
});
```

## Running Tests

```bash
# Run all E2E tests
make client CMD="npm run test:e2e"

# Run specific test
make client CMD="npm run test:e2e -- login.spec.ts"

# Run headed (visible browser)
make client CMD="npm run test:e2e -- --headed"

# Debug mode
make client CMD="npx playwright test --debug"
```

## Key Features

- **Cross-browser**: Chrome, Firefox, Safari, Mobile
- **Visual regression**: Screenshot comparison
- **Accessibility**: axe-core integration
- **Network control**: Throttling and mocking
- **Video recording**: On-failure video capture
- **HTML reports**: Beautiful test reports

## Page Object Model

```typescript
// tests/e2e/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}

// Usage in tests
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login('user@example.com', 'password123');
```

## See Also

- `guide.md` - Complete patterns and examples
- `troubleshooting.md` - Debugging and issue resolution
- `examples/` - Real-world test examples
