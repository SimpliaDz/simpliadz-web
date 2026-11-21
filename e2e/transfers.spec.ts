import { expect, test, type Route } from '@playwright/test';

/** Mocked flow: completing a draft transfer asks first, then shows the completed state. */
test('completes a draft transfer after confirmation', async ({ page }) => {
  const tokens = {
    accessToken: 'access-token',
    expiresMinutes: 60,
    accessTokenExpiresAtUtc: '2030-01-01T00:00:00Z',
    refreshToken: 'refresh-token',
    refreshTokenExpiresAtUtc: '2030-01-14T00:00:00Z',
    email: 'clerk@example.test',
    roles: ['Clerk'],
  };
  const user = {
    userId: '00000000-0000-0000-0000-000000000007',
    email: 'clerk@example.test',
    roles: ['Clerk'],
    permissions: ['stock.view', 'stock.manage'],
  };
  const locations = [
    {
      id: 'loc-main',
      name: 'Main Store',
      code: 'MAIN',
      type: 'Store',
      address: null,
      phone: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'loc-wh',
      name: 'Warehouse',
      code: 'WH',
      type: 'Warehouse',
      address: null,
      phone: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];
  const transfer = {
    id: 'tr-1',
    transferNumber: 'TR-0001',
    sourceLocationId: 'loc-wh',
    destinationLocationId: 'loc-main',
    status: 'Draft',
    createdAt: '2026-01-05T09:00:00Z',
    createdBy: 'clerk',
    completedAt: null,
    completedBy: null,
    lines: [{ id: 'l-1', productVariantId: 'v-1', quantity: 3 }],
  };
  const products = [
    {
      id: 'p-1',
      name: 'Linen shirt',
      code: null,
      description: null,
      brandId: null,
      categoryId: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      variants: [
        {
          id: 'v-1',
          sku: 'LINEN-M',
          barcode: null,
          color: null,
          size: 'M',
          retailPrice: 1000,
          wholesalePrice: null,
          isActive: true,
        },
      ],
    },
  ];
  let completed = false;

  await page.route('**/api/auth/login', (route: Route) => route.fulfill({ json: tokens }));
  await page.route('**/api/auth/me', (route: Route) => route.fulfill({ json: user }));
  await page.route('**/api/auth/refresh', (route: Route) => route.fulfill({ json: tokens }));
  await page.route('**/api/locations', (route: Route) => route.fulfill({ json: locations }));
  await page.route('**/api/products', (route: Route) => route.fulfill({ json: products }));
  await page.route('**/api/stock-transfers/tr-1/complete', (route: Route) => {
    completed = true;
    return route.fulfill({
      json: {
        ...transfer,
        status: 'Completed',
        completedAt: '2026-01-06T10:00:00Z',
        completedBy: 'clerk',
      },
    });
  });
  await page.route('**/api/stock-transfers/tr-1', (route: Route) =>
    route.fulfill({
      json: completed
        ? {
            ...transfer,
            status: 'Completed',
            completedAt: '2026-01-06T10:00:00Z',
            completedBy: 'clerk',
          }
        : transfer,
    }),
  );

  await page.goto('/login');
  await page.getByLabel('Email address').fill('clerk@example.test');
  await page.getByLabel('Password').fill('Correct-horse-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);

  await page.goto('/app/inventory/transfers/tr-1');
  await expect(page.getByRole('heading', { name: 'TR-0001' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete transfer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Complete transfer' }).click();

  await expect(page.getByText('Transfer completed.')).toBeVisible();
  await expect(page.locator('app-status-chip', { hasText: 'Completed' }).first()).toBeVisible();
  expect(completed).toBe(true);
});
