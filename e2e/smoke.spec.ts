import { expect, test } from '@playwright/test';

test('renders the English application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('SimpliaDz');
  await expect(page.getByRole('heading', { name: 'Welcome to SimpliaDz' })).toBeVisible();
});
