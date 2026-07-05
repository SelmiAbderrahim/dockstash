import { test, expect } from '../fixtures';

test('authed dashboard shell renders with mint-JWT cookie', async ({ authedPage }) => {
  const page = await authedPage();
  await page.goto('/dashboard');
  // Client-only SPA — wait for hydration to render either the shell or a
  // legitimate empty/error state. Assert at least a heading appears.
  await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 10_000 });
});

test('register-agent dialog opens on the fleet page', async ({ authedPage }) => {
  const page = await authedPage();
  await page.goto('/fleet');
  // The RegisterAgentDialog trigger is the primary CTA on the fleet page.
  // Copy varies across locales; match the button whose accessible name mentions "agent".
  const trigger = page.getByRole('button', { name: /agent/i }).first();
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
