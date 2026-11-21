import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  permissionGuard,
  requiredPermissionsKey,
} from './core/auth/auth.guards';

/** Attaches the permissions a route needs. The API still enforces every request. */
function permissioned(permissions: readonly string[]) {
  return { canActivate: [permissionGuard], data: { [requiredPermissionsKey]: permissions } };
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/public-layout.component').then((m) => m.PublicLayoutComponent),
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        title: $localize`:@@title.signIn:Sign in | SimpliaDz`,
        loadComponent: () =>
          import('./features/auth/pages/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'forgot-password',
        canActivate: [guestGuard],
        title: $localize`:@@title.forgotPassword:Reset password | SimpliaDz`,
        loadComponent: () =>
          import('./features/auth/pages/forgot-password/forgot-password.page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-password',
        canActivate: [guestGuard],
        title: $localize`:@@title.resetPassword:Choose a password | SimpliaDz`,
        loadComponent: () =>
          import('./features/auth/pages/reset-password/reset-password.page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
    ],
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/shell-layout.component').then((m) => m.ShellLayoutComponent),
    title: 'SimpliaDz',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: $localize`:@@title.dashboard:Dashboard | SimpliaDz`,
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'organization',
        title: $localize`:@@title.organization:Organization | SimpliaDz`,
        ...permissioned(['organization.view']),
        loadComponent: () =>
          import('./features/organization/pages/organization.page').then((m) => m.OrganizationPage),
      },

      // Catalogue
      {
        path: 'catalogue/brands',
        title: $localize`:@@title.brands:Brands | SimpliaDz`,
        ...permissioned(['brands.view']),
        loadComponent: () =>
          import('./features/catalogue/brands/pages/brands.page').then((m) => m.BrandsPage),
      },
      {
        path: 'catalogue/categories',
        title: $localize`:@@title.categories:Categories | SimpliaDz`,
        ...permissioned(['categories.view']),
        loadComponent: () =>
          import('./features/catalogue/categories/pages/categories.page').then(
            (m) => m.CategoriesPage,
          ),
      },
      {
        path: 'catalogue/attributes',
        title: $localize`:@@title.attributes:Attributes | SimpliaDz`,
        ...permissioned(['attributes.view']),
        loadComponent: () =>
          import('./features/catalogue/attributes/pages/attributes.page').then(
            (m) => m.AttributesPage,
          ),
      },
      {
        path: 'catalogue/attributes/:id',
        title: $localize`:@@title.attribute:Attribute | SimpliaDz`,
        ...permissioned(['attributes.view']),
        loadComponent: () =>
          import('./features/catalogue/attributes/pages/attribute-detail.page').then(
            (m) => m.AttributeDetailPage,
          ),
      },
      {
        path: 'catalogue/products',
        title: $localize`:@@title.products:Products | SimpliaDz`,
        ...permissioned(['products.view']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'catalogue/products/new',
        title: $localize`:@@title.newProduct:New product | SimpliaDz`,
        ...permissioned(['products.create']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/product-form.page').then(
            (m) => m.ProductFormPage,
          ),
      },
      {
        path: 'catalogue/products/:id',
        title: $localize`:@@title.product:Product | SimpliaDz`,
        ...permissioned(['products.view']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/product-detail.page').then(
            (m) => m.ProductDetailPage,
          ),
      },
      {
        path: 'catalogue/products/:id/edit',
        title: $localize`:@@title.editProduct:Edit product | SimpliaDz`,
        ...permissioned(['products.edit']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/product-form.page').then(
            (m) => m.ProductFormPage,
          ),
      },
      {
        path: 'catalogue/products/:productId/variants/new',
        title: $localize`:@@title.newVariant:New variant | SimpliaDz`,
        ...permissioned(['variants.create']),
        loadComponent: () =>
          import('./features/catalogue/variants/pages/variant-create.page').then(
            (m) => m.VariantCreatePage,
          ),
      },
      {
        path: 'catalogue/variants/:id',
        title: $localize`:@@title.variant:Variant | SimpliaDz`,
        ...permissioned(['variants.view']),
        loadComponent: () =>
          import('./features/catalogue/variants/pages/variant-detail.page').then(
            (m) => m.VariantDetailPage,
          ),
      },

      // Inventory
      {
        path: 'inventory/locations',
        title: $localize`:@@title.locations:Locations | SimpliaDz`,
        ...permissioned(['locations.view']),
        loadComponent: () =>
          import('./features/inventory/locations/pages/locations.page').then(
            (m) => m.LocationsPage,
          ),
      },
      {
        path: 'inventory/locations/new',
        title: $localize`:@@title.newLocation:New location | SimpliaDz`,
        ...permissioned(['locations.create']),
        loadComponent: () =>
          import('./features/inventory/locations/pages/location-form.page').then(
            (m) => m.LocationFormPage,
          ),
      },
      {
        path: 'inventory/locations/:id/edit',
        title: $localize`:@@title.editLocation:Edit location | SimpliaDz`,
        ...permissioned(['locations.edit']),
        loadComponent: () =>
          import('./features/inventory/locations/pages/location-form.page').then(
            (m) => m.LocationFormPage,
          ),
      },
      {
        path: 'inventory/price-lists',
        title: $localize`:@@title.priceLists:Price lists | SimpliaDz`,
        ...permissioned(['price-lists.view']),
        loadComponent: () =>
          import('./features/inventory/price-lists/pages/price-lists.page').then(
            (m) => m.PriceListsPage,
          ),
      },

      // Administration
      {
        path: 'administration/users',
        title: $localize`:@@title.users:Users | SimpliaDz`,
        ...permissioned(['users.view']),
        loadComponent: () =>
          import('./features/administration/users/pages/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'administration/users/new',
        title: $localize`:@@title.newUser:New user | SimpliaDz`,
        ...permissioned(['users.create']),
        loadComponent: () =>
          import('./features/administration/users/pages/user-create.page').then(
            (m) => m.UserCreatePage,
          ),
      },
      {
        path: 'administration/users/:id',
        title: $localize`:@@title.user:User | SimpliaDz`,
        ...permissioned(['users.view']),
        loadComponent: () =>
          import('./features/administration/users/pages/user-detail.page').then(
            (m) => m.UserDetailPage,
          ),
      },
      {
        path: 'administration/roles',
        title: $localize`:@@title.roles:Roles | SimpliaDz`,
        ...permissioned(['roles.view']),
        loadComponent: () =>
          import('./features/administration/roles/pages/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'administration/roles/:id',
        title: $localize`:@@title.role:Role | SimpliaDz`,
        ...permissioned(['roles.view']),
        loadComponent: () =>
          import('./features/administration/roles/pages/role-detail.page').then(
            (m) => m.RoleDetailPage,
          ),
      },

      // Account and status
      {
        path: 'account/security',
        title: $localize`:@@title.accountSecurity:Security | SimpliaDz`,
        loadComponent: () =>
          import('./features/account/pages/security.page').then((m) => m.SecurityPage),
      },
      {
        path: 'forbidden',
        title: $localize`:@@title.forbidden:Access denied | SimpliaDz`,
        loadComponent: () =>
          import('./features/errors/pages/forbidden.page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: $localize`:@@title.notFound:Page not found | SimpliaDz`,
        loadComponent: () =>
          import('./features/errors/pages/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
  { path: '**', redirectTo: 'app' },
];
