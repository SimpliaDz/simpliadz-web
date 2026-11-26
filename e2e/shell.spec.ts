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

test('shows the remaining credit and sends split POS payments', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({
    json: { ...user, permissions: ['sales.manage'] },
  }));
  await page.route('**/api/pos/context', route => route.fulfill({
    json: { isClockedIn: true, cashRegisterId: 'register-1', cashRegisterCode: 'R1', registers: [] },
  }));
  const sale = {
    id: 'sale-1', customerId: 'customer-1', status: 'Draft', total: 1500, balanceDue: 1500,
    discountAmount: 0, lines: [{ id: 'line-1', productVariantId: 'variant-1', productName: 'Shirt',
      quantity: 1, unitPrice: 1500, lineTotal: 1500 }],
  };
  await page.route('**/api/pos/sales', route => route.fulfill({ json: sale }));
  await page.route('**/api/pos/sales/sale-1/pay', route => route.fulfill({
    json: { sale: { ...sale, status: 'Completed', balanceDue: 500, paidAmount: 1000 } },
  }));

  await signIn(page);
  await page.goto('/app/sales/pos');
  const scanner = page.getByLabel('Scan barcode or SKU');
  await scanner.fill('SHIRT');
  await scanner.press('Enter');
  await page.getByRole('button', { name: 'Cash', exact: true }).click();
  await page.getByLabel('Cash received').fill('600');
  await page.getByLabel('Card received').fill('400');
  const dialog = page.getByRole('dialog', { name: 'Confirm payment' });
  await expect(dialog.getByText('500.00', { exact: true })).toBeVisible();
  const posted = page.waitForRequest('**/api/pos/sales/sale-1/pay');
  await dialog.getByRole('button', { name: /Confirm payment/ }).click();
  expect((await posted).postDataJSON()).toMatchObject({
    expectedTotal: 1500,
    tenders: [{ amount: 600, method: 'Cash' }, { amount: 400, method: 'Card' }],
  });
});

test('shows the dashboard and only permitted navigation after sign in', async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Dashboard');
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Security');
  await expect(page.locator('app-shell-layout')).toContainText('manager@example.test');
});

test('enables Save language after a different language is selected', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('menuitem', { name: 'Profile' }).click();

  const saveButton = page.getByRole('button', { name: 'Save language' });
  await expect(saveButton).toBeDisabled();
  await page.getByRole('combobox', { name: 'Language' }).click();
  await page.getByRole('option', { name: 'French' }).click();
  await expect(saveButton).toBeEnabled();
});

test.describe('small laptop and tablet layout', () => {
  for (const viewport of [
    { name: 'small laptop', width: 1280, height: 800 },
    { name: 'tablet landscape', width: 1024, height: 768 },
    { name: 'tablet portrait', width: 768, height: 1024 },
  ]) {
    test(`keeps the dashboard within the ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signIn(page);

      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await expect(page.locator('.shell-main')).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        )
        .toBe(true);
    });
  }
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
  await expect(page.getByRole('heading', { name: 'Sign in to Simplia' })).toBeVisible();
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
