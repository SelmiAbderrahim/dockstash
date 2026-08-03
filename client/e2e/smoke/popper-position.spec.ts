import { test, expect } from '../fixtures';

/**
 * Radix poppers (dropdown, select, tooltip) position themselves from a ref on
 * the trigger. The vendored shadcn primitives carry explicit `forwardRef`
 * wrappers for exactly this reason — when a ref does not reach the trigger the
 * content still renders, so jsdom tests pass, but it anchors at the viewport
 * origin instead of the trigger. Assert real geometry, not presence.
 */
test('the account dropdown anchors on its trigger, not the viewport origin', async ({
  authedPage,
}) => {
  const page = await authedPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/dashboard', { waitUntil: 'networkidle' });

  const trigger = page.getByRole('button', { name: /account menu/i });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();

  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();

  // The off-screen failure mode parks content at 0,0.
  expect(menuBox!.x, 'menu is not pinned to the viewport origin').toBeGreaterThan(0);
  expect(menuBox!.y, 'menu is not pinned to the viewport origin').toBeGreaterThan(0);
  // And it should sit near its trigger horizontally, not across the page.
  expect(Math.abs(menuBox!.x - triggerBox!.x)).toBeLessThan(400);
});
