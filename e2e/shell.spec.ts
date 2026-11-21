import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Deterministic flows through the authenticated shell. The auth endpoints are mocked so these
 * tests do not depend on backend data; see smoke.spec.ts for the live-backend check.
 */

const tokens = {
  accessToken: 'access-token',
  expiresMinutes: 60,
  accessTokenExpiresAtUtc: '2030-01-01T00:00:00Z',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAtUtc: '2030-01-14T00:00:00Z',
  email: 'manager@example.test',
  roles: ['Manager'],
};

const user = {
  userId: '00000000-0000-0000-0000-000000000042',
  email: 'manager@example.test',
  roles: ['Manager'],
  permissions: ['products.view'],
};

async function mockAuth(page: Page): Promise<void> {
  await page.route('**/api/auth/login', (route: Route) => route.fulfill({ json: tokens }));
  await page.route('**/api/auth/refresh', (route: Route) => route.fulfill({ json: tokens }));
  await page.route('**/api/auth/me', (route: Route) => route.fulfill({ json: user }));
  await page.route('**/api/auth/logout', (route: Route) => route.fulfill({ status: 204 }));
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('manager@example.test');
  await page.getByLabel('Password').fill('Correct-horse-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test('redirects anonymous visitors from the app to sign in with a return URL', async ({ page }) => {
  await page.goto('/app/account/security');

  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fapp%2Faccount%2Fsecurity$/);
});

test('shows the dashboard and only permitted navigation after sign in', async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Dashboard');
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Security');
  await expect(page.locator('app-shell-layout')).toContainText('manager@example.test');
});

test('keeps the session across a reload using the stored refresh token', async ({ page }) => {
  await signIn(page);

  await page.reload();

  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('signs out from the user menu and returns to sign in', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to SimpliaDz' })).toBeVisible();
});

test('rejects mismatched new passwords without calling the API', async ({ page }) => {
  let changeCalls = 0;
  await page.route('**/api/auth/change-password', (route: Route) => {
    changeCalls += 1;
    return route.fulfill({ status: 204 });
  });
  await signIn(page);

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Security' })
    .click();
  await expect(page).toHaveURL(/\/app\/account\/security$/);

  await page.getByLabel('Current password').fill('Correct-horse-1');
  await page.getByLabel('New password', { exact: true }).fill('Another-passphrase-2');
  await page.getByLabel('Confirm new password').fill('Different-passphrase-3');
  await page.getByRole('button', { name: 'Change password' }).click();

  await expect(page.getByText('The passwords do not match.')).toBeVisible();
  expect(changeCalls).toBe(0);
});

test('changes the password, then requires signing in again', async ({ page }) => {
  let submitted: unknown = null;
  await page.route('**/api/auth/change-password', async (route: Route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 204 });
  });
  await signIn(page);

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Security' })
    .click();
  await page.getByLabel('Current password').fill('Correct-horse-1');
  await page.getByLabel('New password', { exact: true }).fill('Another-passphrase-2');
  await page.getByLabel('Confirm new password').fill('Another-passphrase-2');
  await page.getByRole('button', { name: 'Change password' }).click();

  await expect(page).toHaveURL(/\/login\?reason=password-changed$/);
  await expect(page.getByRole('status')).toContainText('Your password was changed.');
  expect(submitted).toEqual({
    currentPassword: 'Correct-horse-1',
    newPassword: 'Another-passphrase-2',
  });
});
