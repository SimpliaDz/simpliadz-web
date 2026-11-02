import { expect, test } from '@playwright/test';

test('redirects an anonymous visitor to sign in', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Sign in | SimpliaDz');
  await expect(page.getByRole('heading', { name: 'Sign in to SimpliaDz' })).toBeVisible();
});
