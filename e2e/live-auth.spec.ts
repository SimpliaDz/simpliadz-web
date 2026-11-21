import { expect, test } from '@playwright/test';

/**
 * Live check against the real API through the browser-facing `/api` path (dev proxy).
 * Requires the backend at http://localhost:5278 with the local dev admin seeded.
 */
test('signs in with the local admin through /api and loads the shell', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@dev.local');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('app-shell-layout')).toContainText('admin@dev.local');
});
