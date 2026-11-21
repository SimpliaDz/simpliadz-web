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

      {
        path: 'inventory/stock',
        title: $localize`:@@title.stock:Stock levels | SimpliaDz`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/stock/pages/stock-levels.page').then(
            (m) => m.StockLevelsPage,
          ),
      },
      {
        path: 'inventory/stock/movements',
        title: $localize`:@@title.movements:Stock movements | SimpliaDz`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/stock/pages/movements.page').then(
            (m) => m.StockMovementsPage,
          ),
      },
      {
        path: 'inventory/stock/policies',
        title: $localize`:@@title.policies:Reorder policies | SimpliaDz`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/stock/pages/policies.page').then(
            (m) => m.ReorderPoliciesPage,
          ),
      },
      {
        path: 'inventory/transfers',
        title: $localize`:@@title.transfers:Stock transfers | SimpliaDz`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/transfers/pages/transfers.page').then(
            (m) => m.TransfersPage,
          ),
      },
      {
        path: 'inventory/transfers/:id',
        title: $localize`:@@title.transfer:Transfer | SimpliaDz`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/transfers/pages/transfer-detail.page').then(
            (m) => m.TransferDetailPage,
          ),
      },
      {
        path: 'inventory/counts',
        title: $localize`:@@title.counts:Stock counts | SimpliaDz`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/counts/pages/counts.page').then((m) => m.CountsPage),
      },
      {
        path: 'inventory/counts/:id',
        title: $localize`:@@title.count:Stock count | SimpliaDz`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/counts/pages/count-detail.page').then(
            (m) => m.CountDetailPage,
          ),
      },
      {
        path: 'inventory/warnings',
        title: $localize`:@@title.warnings:Inventory warnings | SimpliaDz`,
        ...permissioned(['inventory-warnings.view']),
        loadComponent: () =>
          import('./features/inventory/warnings/pages/warnings.page').then((m) => m.WarningsPage),
      },

      // Purchasing
      {
        path: 'purchasing/suppliers',
        title: $localize`:@@title.suppliers:Suppliers | SimpliaDz`,
        ...permissioned(['suppliers.view']),
        loadComponent: () =>
          import('./features/purchasing/suppliers/pages/suppliers.page').then(
            (m) => m.SuppliersPage,
          ),
      },
      {
        path: 'purchasing/orders',
        title: $localize`:@@title.orders:Purchase orders | SimpliaDz`,
        ...permissioned(['purchase-orders.view']),
        loadComponent: () =>
          import('./features/purchasing/orders/pages/purchase-orders.page').then(
            (m) => m.PurchaseOrdersPage,
          ),
      },
      {
        path: 'purchasing/orders/:id',
        title: $localize`:@@title.order:Purchase order | SimpliaDz`,
        ...permissioned(['purchase-orders.view']),
        loadComponent: () =>
          import('./features/purchasing/orders/pages/purchase-order-detail.page').then(
            (m) => m.PurchaseOrderDetailPage,
          ),
      },

      // Sales
      {
        path: 'sales/customers',
        title: $localize`:@@title.customers:Customers | SimpliaDz`,
        ...permissioned(['customers.view']),
        loadComponent: () =>
          import('./features/sales/customers/pages/customers.page').then((m) => m.CustomersPage),
      },
      {
        path: 'sales/cash/registers',
        title: $localize`:@@title.cashRegisters:Cash Registers | SimpliaDz`,
        ...permissioned(['cash-registers.view']),
        loadComponent: () =>
          import('./features/sales/cash/pages/cash-registers.page').then(
            (m) => m.CashRegistersPage,
          ),
      },
      {
        path: 'sales/cash/sessions',
        title: $localize`:@@title.cashSessions:Cash Sessions | SimpliaDz`,
        ...permissioned(['cash-sessions.view']),
        loadComponent: () =>
          import('./features/sales/cash/pages/cash-sessions.page').then((m) => m.CashSessionsPage),
      },
      {
        path: 'sales/cash/sessions/:id',
        title: $localize`:@@title.cashSession:Cash Session | SimpliaDz`,
        ...permissioned(['cash-sessions.view']),
        loadComponent: () =>
          import('./features/sales/cash/pages/cash-session-detail.page').then(
            (m) => m.CashSessionDetailPage,
          ),
      },
      {
        path: 'sales/sales',
        title: $localize`:@@title.sales:Sales | SimpliaDz`,
        ...permissioned(['sales.view']),
        loadComponent: () =>
          import('./features/sales/sales/pages/sales.page').then((m) => m.SalesPage),
      },
      {
        path: 'sales/sales/:id',
        title: $localize`:@@title.sale:Sale | SimpliaDz`,
        ...permissioned(['sales.view']),
        loadComponent: () =>
          import('./features/sales/sales/pages/sale-detail.page').then((m) => m.SaleDetailPage),
      },

      // Accounting and workforce
      {
        path: 'accounting/expenses',
        title: $localize`:@@title.expenses:Expenses | SimpliaDz`,
        ...permissioned(['expenses.view', 'expense-categories.view']),
        loadComponent: () =>
          import('./features/accounting/expenses/pages/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'accounting/expense-categories',
        title: $localize`:@@title.expenseCategories:Expense Categories | SimpliaDz`,
        ...permissioned(['expense-categories.view']),
        loadComponent: () =>
          import('./features/accounting/expenses/pages/expense-categories.page').then(
            (m) => m.ExpenseCategoriesPage,
          ),
      },
      {
        path: 'workforce/clock',
        title: $localize`:@@title.myTime:My Time | SimpliaDz`,

        loadComponent: () =>
          import('./features/workforce/pages/my-time.page').then((m) => m.MyTimePage),
      },
      {
        path: 'workforce/sessions',
        title: $localize`:@@title.workSessions:Work Sessions | SimpliaDz`,
        ...permissioned(['work-sessions.view']),
        loadComponent: () =>
          import('./features/workforce/pages/work-sessions.page').then((m) => m.WorkSessionsPage),
      },
      {
        path: 'workforce/report',
        title: $localize`:@@title.hoursReport:Hours Report | SimpliaDz`,
        ...permissioned(['work-sessions.report']),
        loadComponent: () =>
          import('./features/workforce/pages/hours-report.page').then((m) => m.HoursReportPage),
      },

      // Inventory documents and labels
      {
        path: 'inventory/documents',
        title: $localize`:@@title.documents:Inventory documents | SimpliaDz`,
        ...permissioned(['inventory-documents.view']),
        loadComponent: () =>
          import('./features/inventory/documents/pages/documents.page').then(
            (m) => m.DocumentsPage,
          ),
      },
      {
        path: 'inventory/labels',
        title: $localize`:@@title.labels:Barcode labels | SimpliaDz`,
        ...permissioned(['barcode-labels.view']),
        loadComponent: () =>
          import('./features/inventory/labels/pages/labels.page').then((m) => m.LabelsPage),
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
