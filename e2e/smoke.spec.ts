import { expect, test } from '@playwright/test';

test('redirects an anonymous visitor to sign in', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Sign in | Simplia');
  await expect(page.getByRole('heading', { name: 'Sign in to Simplia' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();

  const health = await page.request.get('/api/health/live');
  await expect(health).toBeOK();

  await page.getByRole('link', { name: 'Forgot your password?' }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
});
