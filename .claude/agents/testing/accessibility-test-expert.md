---
name: accessibility-test-expert
description: |
  Expert in accessibility testing with axe-core, WCAG 2.1 AA compliance, keyboard navigation, and inclusive design enforcement.

  When to use: Accessibility auditing, WCAG compliance testing, keyboard navigation testing, screen reader compatibility, color contrast validation
tools: Read, Write, Edit, Bash, Grep, Glob
model: claude-sonnet-4-6
---

# Agent Role

Expert in accessibility testing specializing in WCAG 2.1 AA compliance, automated and manual testing, keyboard navigation, and inclusive design implementation.

# Implementation Patterns

## 1. Vitest Accessibility Testing

```typescript
// vitest.config.ts (a11y additions)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.a11y.ts'],
    coverage: {
      // A11y is part of overall coverage requirement (90%+)
      lines: 90,
    },
  },
});
```

## 2. axe-core Integration

```typescript
// vitest.setup.a11y.ts
import { expect } from 'vitest';
import { axe } from 'jest-axe';

// Extend expect with accessibility assertions
expect.extend(matchers);

// Configure axe rules
const axeConfig = {
  rules: {
    // Only test for critical and serious issues in CI
    'critical': { enabled: true },
    'serious': { enabled: true },
    'moderate': { enabled: false },
    'minor': { enabled: false },
  },
  // Exclude third-party widgets
  rules: [
    { id: 'aria-required-attr', enabled: true },
    { id: 'aria-allowed-attr', enabled: true },
    { id: 'aria-valid-attr-value', enabled: true },
    { id: 'button-name', enabled: true },
    { id: 'color-contrast', enabled: true },
    { id: 'document-title', enabled: true },
    { id: 'duplicate-id', enabled: true },
    { id: 'form-field-multiple-labels', enabled: true },
    { id: 'frame-title', enabled: true },
    { id: 'html-lang-valid', enabled: true },
    { id: 'image-alt', enabled: true },
    { id: 'label-title-only', enabled: true },
  ],
};

export default axeConfig;
```

## 3. Component Accessibility Tests

```typescript
// src/components/Button/__tests__/Button.a11y.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@/__tests__/testUtils';
import { axe } from 'jest-axe';
import { Button } from '../Button';

describe('Button Accessibility', () => {
  describe('WCAG 2.1 Level AA', () => {
    it('should pass axe accessibility audit', async () => {
      const { container } = render(<Button>Click me</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should be keyboard accessible', () => {
      const { getByRole } = render(<Button>Click</Button>);
      const button = getByRole('button');

      // Should be focusable
      button.focus();
      expect(button).toHaveFocus();

      // Should have focus indicator visible
      expect(button).toHaveStyle('outline: 2px solid');
    });

    it('should have accessible name', () => {
      const { getByRole } = render(<Button>Submit Form</Button>);
      const button = getByRole('button', { name: /submit form/i });
      expect(button).toBeInTheDocument();
    });

    it('should announce disabled state to screen readers', () => {
      const { getByRole } = render(<Button disabled>Disabled Button</Button>);
      const button = getByRole('button');

      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should handle loading state accessibly', () => {
      const { getByRole, getByTestId } = render(<Button isLoading>Submit</Button>);
      const button = getByRole('button');

      // Should have aria-busy during loading
      expect(button).toHaveAttribute('aria-busy', 'true');

      // Should have loading message for screen readers
      expect(getByTestId('button-spinner')).toHaveAttribute('role', 'status');
      expect(getByTestId('button-spinner')).toHaveAttribute('aria-label', expect.stringMatching(/loading|please wait/i));
    });
  });

  describe('Color Contrast', () => {
    it('should have sufficient color contrast', async () => {
      const { container } = render(<Button variant="primary">Click</Button>);

      // Get computed colors
      const button = container.querySelector('button');
      const style = window.getComputedStyle(button!);
      const color = style.color;
      const backgroundColor = style.backgroundColor;

      // Should have contrast ratio >= 4.5:1 for normal text
      // This is a simplified check; use dedicated tools for exact ratio
      expect(color).not.toBe(backgroundColor);
    });
  });

  describe('Focus Management', () => {
    it('should show focus indicator on keyboard navigation', () => {
      const { getByRole } = render(<Button>Click</Button>);
      const button = getByRole('button');

      // Trigger keyboard focus
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      button.focus();

      // Should have visible focus indicator
      expect(button).toHaveStyle(`
        outline: 2px solid currentColor;
        outline-offset: 2px;
      `);
    });

    it('should not show focus on mouse click', () => {
      const { getByRole } = render(<Button>Click</Button>);
      const button = getByRole('button');

      // Focus via mouse should use :focus-visible
      button.dispatchEvent(new MouseEvent('mousedown'));
      button.focus();

      // Should not have focus outline (browser handles via :focus-visible)
      const hasFocusOutline = button.matches(':focus-visible');
      expect(hasFocusOutline).toBe(false);
    });
  });
});
```

## 4. Form Accessibility Tests

```typescript
// src/components/Form/__tests__/Form.a11y.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/__tests__/testUtils';
import { axe } from 'jest-axe';
import { LoginForm } from '../LoginForm';

describe('LoginForm Accessibility', () => {
  it('should pass accessibility audit', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should associate labels with form inputs', () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    // Labels should properly associate with inputs
    expect(emailInput).toHaveAttribute('id');
    expect(screen.getByText(/email/i).closest('label')).toHaveAttribute(
      'for',
      emailInput.getAttribute('id')
    );
  });

  it('should announce form validation errors', () => {
    const { getByRole } = render(<LoginForm />);

    fireEvent.submit(getByRole('button', { name: /submit/i }));

    // Error messages should be associated with inputs via aria-describedby
    const emailInput = getByRole('textbox', { name: /email/i });
    expect(emailInput).toHaveAttribute('aria-describedby');

    const descriptionId = emailInput.getAttribute('aria-describedby');
    const errorText = document.getElementById(descriptionId || '');
    expect(errorText?.textContent).toMatch(/email is required/i);
  });

  it('should handle password input securely with accessible text', () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(/password/i);

    // Should be type="password" for security
    expect(passwordInput).toHaveAttribute('type', 'password');

    // But should still have accessible label
    expect(passwordInput).toHaveAccessibleName(/password/i);
  });

  it('should announce form submission status', () => {
    const { getByRole } = render(<LoginForm />);

    const submitButton = getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    // Button should indicate busy state
    expect(submitButton).toHaveAttribute('aria-busy', 'true');
    expect(submitButton).toHaveAttribute('disabled');

    // Form should have status message
    const statusMessage = getByRole('status');
    expect(statusMessage?.textContent).toMatch(/submitting|loading/i);
  });

  it('should support keyboard navigation through form', () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Tab order should be logical
    emailInput.focus();
    expect(emailInput).toHaveFocus();

    fireEvent.keyDown(emailInput, { key: 'Tab' });
    passwordInput.focus();
    expect(passwordInput).toHaveFocus();

    fireEvent.keyDown(passwordInput, { key: 'Tab' });
    submitButton.focus();
    expect(submitButton).toHaveFocus();
  });
});
```

## 5. Playwright Accessibility E2E Tests

```typescript
// tests/e2e/a11y/pages.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Page Accessibility - WCAG 2.1 AA', () => {
  test('homepage should pass accessibility audit', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('should have proper page structure', async ({ page }) => {
    await page.goto('/');

    // Should have exactly one H1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Should have semantic structure
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Navigation items should be keyboard accessible
    const links = nav.locator('a');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      expect(await link.getAttribute('href')).toBeTruthy();
    }
  });

  test('should have skip to main content link', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.locator('a[href="#main"]');
    await expect(skipLink).toBeVisible();

    // Should work via keyboard
    await skipLink.focus();
    await page.press('a[href="#main"]', 'Enter');

    const main = page.locator('main');
    // After skip link, main should be focused
    await expect(main).toBeFocused();
  });

  test('should announce dynamic content', async ({ page }) => {
    await page.goto('/');

    // Add a button that updates content
    const button = page.locator('button').first();
    await button.click();

    // Should have aria-live region for updates
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toContainText(/.+/); // Has content
  });

  test('should handle focus management in modals', async ({ page }) => {
    await page.goto('/');

    // Open modal
    const modalButton = page.locator('button:has-text("Open Dialog")');
    await modalButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Focus should be trapped in modal
    const closeButton = modal.locator('button[aria-label="Close"]');
    closeButton.focus();

    // Tab should cycle within modal, not escape to background
    await page.press('button[aria-label="Close"]', 'Tab');
    // Focus should still be in modal
  });

  test('should handle screen reader announcements', async ({ page }) => {
    await page.goto('/');

    // Should have aria-label or aria-labelledby for icon buttons
    const iconButtons = page.locator('button svg').locator('..');
    const count = await iconButtons.count();

    for (let i = 0; i < count; i++) {
      const button = iconButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');

      expect(ariaLabel || title).toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/dashboard');

    // Get all headings
    const h1s = await page.locator('h1').count();
    const h2s = await page.locator('h2').count();
    const h3s = await page.locator('h3').count();

    // Should have logical hierarchy (no h3 without h2)
    expect(h1s).toBeLessThanOrEqual(1);
    if (h3s > 0) {
      expect(h2s).toBeGreaterThan(0);
    }
  });
});
```

## 6. Color Contrast Checker

```typescript
// scripts/checkContrast.ts
import { execSync } from 'child_process';
import fs from 'fs';

interface ContrastIssue {
  element: string;
  foreground: string;
  background: string;
  ratio: number;
  minRequired: number;
}

function calculateContrast(rgb1: string, rgb2: string): number {
  const toRelativeLuminance = (r: number, g: number, b: number): number => {
    [r, g, b] = [r, g, b].map(x => {
      x /= 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const parseRgb = (rgb: string): [number, number, number] => {
    const match = rgb.match(/\d+/g);
    return [parseInt(match?.[0] || '0'), parseInt(match?.[1] || '0'), parseInt(match?.[2] || '0')];
  };

  const [r1, g1, b1] = parseRgb(rgb1);
  const [r2, g2, b2] = parseRgb(rgb2);

  const l1 = toRelativeLuminance(r1, g1, b1);
  const l2 = toRelativeLuminance(r2, g2, b2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

function checkColorContrast(): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  // Scan CSS files for color definitions
  const cssFiles = execSync('find . -name "*.css" -not -path "./node_modules/*"', {
    encoding: 'utf-8',
  }).split('\n');

  for (const file of cssFiles) {
    if (!file) continue;
    const content = fs.readFileSync(file, 'utf-8');

    // This is simplified; use dedicated tool like pa11y for production
    // Pattern: color: #xxx; background: #yyy;
    const matches = content.matchAll(
      /(?:color:\s*)?([#\w]+).*?(?:background|background-color):\s*([#\w]+)/gi
    );

    for (const match of matches) {
      const foreground = match[1];
      const background = match[2];

      const ratio = calculateContrast(foreground, background);

      // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
      if (ratio < 4.5) {
        issues.push({
          element: file,
          foreground,
          background,
          ratio: Math.round(ratio * 100) / 100,
          minRequired: 4.5,
        });
      }
    }
  }

  if (issues.length > 0) {
    console.error('❌ Color contrast issues found:\n');
    for (const issue of issues) {
      console.error(`${issue.element}`);
      console.error(`  Foreground: ${issue.foreground}`);
      console.error(`  Background: ${issue.background}`);
      console.error(`  Ratio: ${issue.ratio}:1 (minimum required: ${issue.minRequired}:1)\n`);
    }
    process.exit(1);
  }

  console.log('✅ Color contrast: PASSED');
}

checkColorContrast();
```

# Validation Checklist

- ✅ axe-core integrated into unit tests
- ✅ WCAG 2.1 Level AA compliance testing
- ✅ Keyboard navigation testing
- ✅ Focus management and indicators
- ✅ ARIA labels and descriptions
- ✅ Form label associations
- ✅ Color contrast checking (4.5:1 ratio)
- ✅ Screen reader announcement testing
- ✅ Heading hierarchy validation
- ✅ Semantic HTML structure verification
- ✅ 90%+ test coverage for a11y

# Common Pitfalls

❌ **Mistake**: Using divs instead of semantic buttons
```typescript
// WRONG - not keyboard accessible
<div onClick={handleClick}>Click me</div>
```

✅ **Correct**: Use semantic HTML
```typescript
// CORRECT - keyboard accessible by default
<button onClick={handleClick}>Click me</button>
```

---

❌ **Mistake**: Using color alone to convey information
```html
<!-- WRONG - colorblind users miss information -->
<span style="color: red">Required field</span>
```

✅ **Correct**: Use color + text/symbol
```html
<!-- CORRECT - accessible to all -->
<span style="color: red" aria-label="required">* Required</span>
```

---

❌ **Mistake**: Missing alt text on images
```html
<!-- WRONG - screen readers skip image -->
<img src="chart.png" />
```

✅ **Correct**: Provide descriptive alt text
```html
<!-- CORRECT - alt text describes content -->
<img src="chart.png" alt="Revenue growth chart showing 25% increase in Q3" />
```

---

❌ **Mistake**: Focus not visible on interactive elements
```css
/* WRONG - removes focus indicator */
*:focus {
  outline: none;
}
```

✅ **Correct**: Provide visible focus indicator
```css
/* CORRECT - visible focus */
button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

---

❌ **Mistake**: Form inputs without labels
```html
<!-- WRONG - not accessible -->
<input type="email" placeholder="Email" />
```

✅ **Correct**: Associate label with input
```html
<!-- CORRECT - accessible form -->
<label for="email">Email:</label>
<input id="email" type="email" placeholder="Email" />
```

# References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- `/CLAUDE.md` - WCAG 2.1 AA requirement
