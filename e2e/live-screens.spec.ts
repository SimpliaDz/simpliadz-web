import { expect, test } from '@playwright/test';

/**
 * Live check: the list screens load real data from the backend through `/api` with the local
 * dev admin. Requires the API at http://localhost:5278. A failure here means a screen and the
 * backend contract have drifted apart.
 */
const screens: { path: string; heading: string }[] = [
  { path: '/app/organization', heading: 'Organization' },
  { path: '/app/catalogue/products', heading: 'Products' },
  { path: '/app/catalogue/brands', heading: 'Brands' },
  { path: '/app/catalogue/categories', heading: 'Categories' },
  { path: '/app/catalogue/attributes', heading: 'Attributes' },
  { path: '/app/inventory/locations', heading: 'Locations' },
  { path: '/app/inventory/price-lists', heading: 'Price lists' },
  { path: '/app/inventory/stock', heading: 'Stock levels' },
  { path: '/app/inventory/stock/movements', heading: 'Stock movements' },
  { path: '/app/inventory/stock/policies', heading: 'Reorder policies' },
  { path: '/app/inventory/transfers', heading: 'Stock transfers' },
  { path: '/app/inventory/counts', heading: 'Stock counts' },
  { path: '/app/inventory/warnings', heading: 'Inventory warnings' },
  { path: '/app/purchasing/suppliers', heading: 'Suppliers' },
  { path: '/app/purchasing/orders', heading: 'Purchase orders' },
  { path: '/app/sales/customers', heading: 'Customers' },
  { path: '/app/sales/cash/registers', heading: 'Cash registers' },
  { path: '/app/sales/cash/sessions', heading: 'Cash sessions' },
  { path: '/app/sales/sales', heading: 'Sales' },
  { path: '/app/accounting/expenses', heading: 'Expenses' },
  { path: '/app/accounting/expense-categories', heading: 'Expense categories' },
  { path: '/app/workforce/clock', heading: 'My time' },
  { path: '/app/workforce/sessions', heading: 'Work sessions' },
  { path: '/app/workforce/report', heading: 'Hours report' },
  { path: '/app/administration/users', heading: 'Users' },
  { path: '/app/administration/roles', heading: 'Roles' },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@dev.local');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});

for (const screen of screens) {
  test(`loads ${screen.heading} from the live API without an error state`, async ({ page }) => {
    await page.goto(screen.path);

    await expect(
      page.getByRole('heading', { level: 1, name: screen.heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/could not load/i)).toHaveCount(0);
  });
}
