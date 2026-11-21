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

    await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
    await expect(page.getByText(/could not load/i)).toHaveCount(0);
  });
}
