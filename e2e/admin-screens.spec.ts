import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Mocked flows for the catalogue, inventory and administration screens. The API is replaced
 * with in-memory fixtures, so these tests run without the backend.
 */

const tokens = {
  accessToken: 'access-token',
  expiresMinutes: 60,
  accessTokenExpiresAtUtc: '2030-01-01T00:00:00Z',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAtUtc: '2030-01-14T00:00:00Z',
  email: 'admin@example.test',
  roles: ['Admin'],
};

async function signInWith(page: Page, permissions: string[]): Promise<void> {
  const user = {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@example.test',
    roles: ['Admin'],
    permissions,
  };
  await page.route('**/api/auth/login', (route: Route) => route.fulfill({ json: tokens }));
  await page.route('**/api/auth/refresh', (route: Route) => route.fulfill({ json: tokens }));
  await page.route('**/api/auth/me', (route: Route) => route.fulfill({ json: user }));
  await page.route('**/api/auth/logout', (route: Route) => route.fulfill({ status: 204 }));

  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.getByLabel('Password').fill('Correct-horse-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

test('shows only the navigation entries the user is allowed to use', async ({ page }) => {
  await signInWith(page, ['brands.view']);

  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Brands' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Products' })).toHaveCount(0);
});

test('redirects a direct visit to a forbidden screen', async ({ page }) => {
  await signInWith(page, []);

  await page.goto('/app/catalogue/brands');

  await expect(page).toHaveURL(/\/app\/forbidden$/);
  await expect(
    page.getByRole('heading', { name: 'You do not have access to this page' }),
  ).toBeVisible();
});

test('creates a brand from the dialog and shows it in the list', async ({ page }) => {
  const brands: { id: string; name: string; isActive: boolean; updatedAt: string }[] = [
    { id: 'b-1', name: 'Atlas', isActive: true, updatedAt: '2026-01-02T00:00:00Z' },
  ];
  let created: unknown = null;

  await signInWith(page, ['brands.view', 'brands.create', 'brands.edit']);
  await page.route('**/api/brands', async (route: Route) => {
    if (route.request().method() === 'POST') {
      created = route.request().postDataJSON();
      const brand = {
        id: 'b-2',
        name: 'Borealis',
        isActive: true,
        updatedAt: '2026-01-03T00:00:00Z',
      };
      brands.push(brand);
      return route.fulfill({ status: 201, json: brand });
    }
    return route.fulfill({ json: brands });
  });

  await page.goto('/app/catalogue/brands');
  await expect(page.getByRole('cell', { name: 'Atlas', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New brand' }).click();
  await page.getByLabel('Brand name').fill('Borealis');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('cell', { name: 'Borealis', exact: true })).toBeVisible();
  expect(created).toEqual({ name: 'Borealis' });
});

test('saves only the permissions that changed on a role', async ({ page }) => {
  let posted: unknown = null;
  let deleted: unknown = null;

  await signInWith(page, ['roles.view', 'roles.manage']);
  await page.route('**/api/roles/role-1', (route: Route) =>
    route.fulfill({ json: { id: 'role-1', name: 'Store clerk', permissions: ['brands.view'] } }),
  );
  await page.route('**/api/permissions', (route: Route) =>
    route.fulfill({
      json: [
        { name: 'brands.view', displayName: 'View brands', category: 'Brands' },
        { name: 'brands.create', displayName: 'Create brands', category: 'Brands' },
      ],
    }),
  );
  await page.route('**/api/roles/role-1/permissions', async (route: Route) => {
    if (route.request().method() === 'POST') {
      posted = route.request().postDataJSON();
    } else {
      deleted = route.request().postDataJSON();
    }
    return route.fulfill({ status: 204 });
  });

  await page.goto('/app/administration/roles/role-1');
  await page.getByRole('checkbox', { name: /Create brands/ }).check();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => posted).toEqual({ permissions: ['brands.create'] });
  expect(deleted).toBeNull();
});

test('creates a product and opens its detail page', async ({ page }) => {
  let body: unknown = null;

  await signInWith(page, ['products.view', 'products.create', 'brands.view', 'categories.view']);
  await page.route('**/api/brands', (route: Route) =>
    route.fulfill({
      json: [{ id: 'b-1', name: 'Atlas', isActive: true, updatedAt: '2026-01-02T00:00:00Z' }],
    }),
  );
  await page.route('**/api/categories', (route: Route) => route.fulfill({ json: [] }));
  await page.route('**/api/products', async (route: Route) => {
    if (route.request().method() === 'POST') {
      body = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: 'p-1' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/products/p-1', (route: Route) =>
    route.fulfill({
      json: {
        id: 'p-1',
        name: 'Linen shirt',
        code: 'LINEN-SHIRT',
        description: null,
        brandId: 'b-1',
        categoryId: null,
        isActive: true,
        createdAt: '2026-01-04T00:00:00Z',
        updatedAt: '2026-01-04T00:00:00Z',
        variants: [],
      },
    }),
  );

  await page.goto('/app/catalogue/products/new');
  await page.getByLabel('Product name').fill('Linen shirt');
  await page.getByLabel('Code').fill('linen-shirt');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/app\/catalogue\/products\/p-1$/);
  await expect(page.getByRole('heading', { name: 'Linen shirt' })).toBeVisible();
  expect(body).toEqual({
    name: 'Linen shirt',
    code: 'linen-shirt',
    description: null,
    brandId: null,
    categoryId: null,
  });
});
