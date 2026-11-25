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
        title: $localize`:@@title.signIn:Sign in | Simplia`,
        loadComponent: () =>
          import('./features/auth/pages/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'forgot-password',
        canActivate: [guestGuard],
        title: $localize`:@@title.forgotPassword:Reset password | Simplia`,
        loadComponent: () =>
          import('./features/auth/pages/forgot-password/forgot-password.page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-password',
        canActivate: [guestGuard],
        title: $localize`:@@title.resetPassword:Choose a password | Simplia`,
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
    title: 'Simplia',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: $localize`:@@title.dashboard:Dashboard | Simplia`,
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'organization',
        title: $localize`:@@title.organization:Organization | Simplia`,
        ...permissioned(['organization.view']),
        loadComponent: () =>
          import('./features/organization/pages/organization.page').then((m) => m.OrganizationPage),
      },
      {
        path: 'organization/settings',
        title: 'Organization settings | Simplia',
        ...permissioned(['organization.manage']),
        loadComponent: () => import('./features/organization/pages/organization-settings.page').then((m) => m.OrganizationSettingsPage),
      },

      // Catalogue
      {
        path: 'catalogue/brands',
        title: $localize`:@@title.brands:Brands | Simplia`,
        ...permissioned(['brands.view']),
        loadComponent: () =>
          import('./features/catalogue/brands/pages/brands.page').then((m) => m.BrandsPage),
      },
      {
        path: 'catalogue/categories',
        title: $localize`:@@title.categories:Categories | Simplia`,
        ...permissioned(['categories.view']),
        loadComponent: () =>
          import('./features/catalogue/categories/pages/categories.page').then(
            (m) => m.CategoriesPage,
          ),
      },
      {
        path: 'catalogue/attributes',
        title: $localize`:@@title.attributes:Attributes | Simplia`,
        ...permissioned(['attributes.view']),
        loadComponent: () =>
          import('./features/catalogue/attributes/pages/attributes.page').then(
            (m) => m.AttributesPage,
          ),
      },
      {
        path: 'catalogue/attributes/:id',
        title: $localize`:@@title.attribute:Attribute | Simplia`,
        ...permissioned(['attributes.view']),
        loadComponent: () =>
          import('./features/catalogue/attributes/pages/attribute-detail.page').then(
            (m) => m.AttributeDetailPage,
          ),
      },
      {
        path: 'catalogue/products',
        title: $localize`:@@title.products:Products | Simplia`,
        ...permissioned(['products.view']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'catalogue/products/new',
        title: $localize`:@@title.newProduct:New product | Simplia`,
        ...permissioned(['products.create']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/product-form.page').then(
            (m) => m.ProductFormPage,
          ),
      },
      {
        path: 'catalogue/products/:id',
        title: $localize`:@@title.product:Product | Simplia`,
        ...permissioned(['products.view']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/product-detail.page').then(
            (m) => m.ProductDetailPage,
          ),
      },
      {
        path: 'catalogue/products/:id/edit',
        title: $localize`:@@title.editProduct:Edit product | Simplia`,
        ...permissioned(['products.edit']),
        loadComponent: () =>
          import('./features/catalogue/products/pages/product-form.page').then(
            (m) => m.ProductFormPage,
          ),
      },
      {
        path: 'catalogue/products/:productId/variants/new',
        title: $localize`:@@title.newVariant:New variant | Simplia`,
        ...permissioned(['variants.create']),
        loadComponent: () =>
          import('./features/catalogue/variants/pages/variant-create.page').then(
            (m) => m.VariantCreatePage,
          ),
      },
      {
        path: 'catalogue/variants/:id',
        title: $localize`:@@title.variant:Variant | Simplia`,
        ...permissioned(['variants.view']),
        loadComponent: () =>
          import('./features/catalogue/variants/pages/variant-detail.page').then(
            (m) => m.VariantDetailPage,
          ),
      },

      // Inventory
      {
        path: 'inventory/locations',
        title: $localize`:@@title.locations:Locations | Simplia`,
        ...permissioned(['locations.view']),
        loadComponent: () =>
          import('./features/inventory/locations/pages/locations.page').then(
            (m) => m.LocationsPage,
          ),
      },
      {
        path: 'inventory/locations/new',
        title: $localize`:@@title.newLocation:New location | Simplia`,
        ...permissioned(['locations.create']),
        loadComponent: () =>
          import('./features/inventory/locations/pages/location-form.page').then(
            (m) => m.LocationFormPage,
          ),
      },
      {
        path: 'inventory/locations/:id/edit',
        title: $localize`:@@title.editLocation:Edit location | Simplia`,
        ...permissioned(['locations.edit']),
        loadComponent: () =>
          import('./features/inventory/locations/pages/location-form.page').then(
            (m) => m.LocationFormPage,
          ),
      },
      {
        path: 'inventory/price-lists',
        title: $localize`:@@title.priceLists:Price lists | Simplia`,
        ...permissioned(['price-lists.view']),
        loadComponent: () =>
          import('./features/inventory/price-lists/pages/price-lists.page').then(
            (m) => m.PriceListsPage,
          ),
      },

      {
        path: 'inventory/stock',
        title: $localize`:@@title.stock:Stock levels | Simplia`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/stock/pages/stock-levels.page').then(
            (m) => m.StockLevelsPage,
          ),
      },
      {
        path: 'inventory/stock/movements',
        title: $localize`:@@title.movements:Stock movements | Simplia`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/stock/pages/movements.page').then(
            (m) => m.StockMovementsPage,
          ),
      },
      {
        path: 'inventory/stock/policies',
        title: $localize`:@@title.policies:Reorder policies | Simplia`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/stock/pages/policies.page').then(
            (m) => m.ReorderPoliciesPage,
          ),
      },
      {
        path: 'inventory/transfers',
        title: $localize`:@@title.transfers:Stock transfers | Simplia`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/transfers/pages/transfers.page').then(
            (m) => m.TransfersPage,
          ),
      },
      {
        path: 'inventory/transfers/:id',
        title: $localize`:@@title.transfer:Transfer | Simplia`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/transfers/pages/transfer-detail.page').then(
            (m) => m.TransferDetailPage,
          ),
      },
      {
        path: 'inventory/counts',
        title: $localize`:@@title.counts:Stock counts | Simplia`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/counts/pages/counts.page').then((m) => m.CountsPage),
      },
      {
        path: 'inventory/counts/:id',
        title: $localize`:@@title.count:Stock count | Simplia`,
        ...permissioned(['stock.view']),
        loadComponent: () =>
          import('./features/inventory/counts/pages/count-detail.page').then(
            (m) => m.CountDetailPage,
          ),
      },
      {
        path: 'inventory/warnings',
        title: $localize`:@@title.warnings:Inventory warnings | Simplia`,
        ...permissioned(['inventory-warnings.view']),
        loadComponent: () =>
          import('./features/inventory/warnings/pages/warnings.page').then((m) => m.WarningsPage),
      },

      // Purchasing
      {
        path: 'purchasing/suppliers',
        title: $localize`:@@title.suppliers:Suppliers | Simplia`,
        ...permissioned(['suppliers.view']),
        loadComponent: () =>
          import('./features/purchasing/suppliers/pages/suppliers.page').then(
            (m) => m.SuppliersPage,
          ),
      },
      {
        path: 'purchasing/orders',
        title: $localize`:@@title.orders:Purchase orders | Simplia`,
        ...permissioned(['purchase-orders.view']),
        loadComponent: () =>
          import('./features/purchasing/orders/pages/purchase-orders.page').then(
            (m) => m.PurchaseOrdersPage,
          ),
      },
      {
        path: 'purchasing/orders/:id',
        title: $localize`:@@title.order:Purchase order | Simplia`,
        ...permissioned(['purchase-orders.view']),
        loadComponent: () =>
          import('./features/purchasing/orders/pages/purchase-order-detail.page').then(
            (m) => m.PurchaseOrderDetailPage,
          ),
      },

      // Sales
      {
        path: 'crm/loyalty',
        title: $localize`:@@title.loyalty:Customer loyalty | Simplia`,
        ...permissioned(['crm.view']),
        loadComponent: () =>
          import('./features/crm/pages/loyalty.page').then((m) => m.LoyaltyPage),
      },
      {
        path: 'sales/customers',
        title: $localize`:@@title.customers:Customers | Simplia`,
        ...permissioned(['customers.view']),
        loadComponent: () =>
          import('./features/sales/customers/pages/customers.page').then((m) => m.CustomersPage),
      },
      {
        path: 'sales/cash/registers',
        title: $localize`:@@title.cashRegisters:Cash Registers | Simplia`,
        ...permissioned(['cash-registers.view']),
        loadComponent: () =>
          import('./features/sales/cash/pages/cash-registers.page').then(
            (m) => m.CashRegistersPage,
          ),
      },
      {
        path: 'sales/cash/sessions',
        title: $localize`:@@title.cashSessions:Cash Sessions | Simplia`,
        ...permissioned(['cash-sessions.view']),
        loadComponent: () =>
          import('./features/sales/cash/pages/cash-sessions.page').then((m) => m.CashSessionsPage),
      },
      {
        path: 'sales/cash/sessions/:id',
        title: $localize`:@@title.cashSession:Cash Session | Simplia`,
        ...permissioned(['cash-sessions.view']),
        loadComponent: () =>
          import('./features/sales/cash/pages/cash-session-detail.page').then(
            (m) => m.CashSessionDetailPage,
          ),
      },
      {
        path: 'sales/pos',
        title: $localize`:@@title.pos:Point of Sale | Simplia`,
        ...permissioned(['sales.manage']),
        loadComponent: () =>
          import('./features/sales/sales/pages/pos.page').then((m) => m.PosPage),
      },
      {
        path: 'sales/promotions',
        title: 'Promotions | Simplia',
        ...permissioned(['sales.manage', 'sales.discounts.apply']),
        loadComponent: () =>
          import('./features/sales/sales/pages/promotions.page').then(m => m.PromotionsPage),
      },
      {
        path: 'sales/sales',
        title: $localize`:@@title.sales:Sales | Simplia`,
        ...permissioned(['sales.view']),
        loadComponent: () =>
          import('./features/sales/sales/pages/sales.page').then((m) => m.SalesPage),
      },
      {
        path: 'sales/sales/:id',
        title: $localize`:@@title.sale:Sale | Simplia`,
        ...permissioned(['sales.view']),
        loadComponent: () =>
          import('./features/sales/sales/pages/sale-detail.page').then((m) => m.SaleDetailPage),
      },

      // Accounting and workforce
      {
        path: 'accounting/expenses',
        title: $localize`:@@title.expenses:Expenses | Simplia`,
        ...permissioned(['expenses.view', 'expense-categories.view']),
        loadComponent: () =>
          import('./features/accounting/expenses/pages/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'accounting/expense-categories',
        title: $localize`:@@title.expenseCategories:Expense Categories | Simplia`,
        ...permissioned(['expense-categories.view']),
        loadComponent: () =>
          import('./features/accounting/expenses/pages/expense-categories.page').then(
            (m) => m.ExpenseCategoriesPage,
          ),
      },
      {
        path: 'workforce/clock',
        title: $localize`:@@title.myTime:My Time | Simplia`,

        loadComponent: () =>
          import('./features/workforce/pages/my-time.page').then((m) => m.MyTimePage),
      },
      {
        path: 'workforce/sessions',
        title: $localize`:@@title.workSessions:Work Sessions | Simplia`,
        ...permissioned(['work-sessions.view']),
        loadComponent: () =>
          import('./features/workforce/pages/work-sessions.page').then((m) => m.WorkSessionsPage),
      },
      {
        path: 'workforce/report',
        title: $localize`:@@title.hoursReport:Hours Report | Simplia`,
        ...permissioned(['work-sessions.report']),
        loadComponent: () =>
          import('./features/workforce/pages/hours-report.page').then((m) => m.HoursReportPage),
      },

      // Inventory documents and labels
      {
        path: 'inventory/documents',
        title: $localize`:@@title.documents:Inventory documents | Simplia`,
        ...permissioned(['inventory-documents.view']),
        loadComponent: () =>
          import('./features/inventory/documents/pages/documents.page').then(
            (m) => m.DocumentsPage,
          ),
      },
      {
        path: 'inventory/labels',
        title: $localize`:@@title.labels:Barcode labels | Simplia`,
        ...permissioned(['barcode-labels.view']),
        loadComponent: () =>
          import('./features/inventory/labels/pages/labels.page').then((m) => m.LabelsPage),
      },

      // Reports and audit
      {
        path: 'reports/financial',
        title: 'Financial dashboard | Simplia',
        ...permissioned(['reports.sales-summary.view']),
        loadComponent: () => import('./features/reporting/pages/financial-dashboard.page').then((m) => m.FinancialDashboardPage),
      },
      {
        path: 'reports/sales',
        title: $localize`:@@title.report.sales:Sales summary | Simplia`,
        canActivate: [permissionGuard],
        data: { report: 'sales', [requiredPermissionsKey]: ['reports.sales-summary.view'] },
        loadComponent: () =>
          import('./features/reporting/pages/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'reports/products',
        title: $localize`:@@title.report.products:Product performance | Simplia`,
        canActivate: [permissionGuard],
        data: {
          report: 'products',
          [requiredPermissionsKey]: ['reports.product-performance.view'],
        },
        loadComponent: () =>
          import('./features/reporting/pages/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'reports/inventory',
        title: $localize`:@@title.report.inventory:Inventory report | Simplia`,
        canActivate: [permissionGuard],
        data: { report: 'inventory', [requiredPermissionsKey]: ['reports.inventory.view'] },
        loadComponent: () =>
          import('./features/reporting/pages/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'reports/low-stock',
        title: $localize`:@@title.report.lowStock:Low stock | Simplia`,
        canActivate: [permissionGuard],
        data: { report: 'lowStock', [requiredPermissionsKey]: ['reports.low-stock.view'] },
        loadComponent: () =>
          import('./features/reporting/pages/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'administration/audit',
        title: $localize`:@@title.audit:Audit log | Simplia`,
        ...permissioned(['audit.view']),
        loadComponent: () =>
          import('./features/audit/pages/audit-log.page').then((m) => m.AuditLogPage),
      },
      // Administration
      {
        path: 'administration/users',
        title: $localize`:@@title.users:Users | Simplia`,
        ...permissioned(['users.view']),
        loadComponent: () =>
          import('./features/administration/users/pages/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'administration/users/new',
        title: $localize`:@@title.newUser:New user | Simplia`,
        ...permissioned(['users.create']),
        loadComponent: () =>
          import('./features/administration/users/pages/user-create.page').then(
            (m) => m.UserCreatePage,
          ),
      },
      {
        path: 'administration/users/:id',
        title: $localize`:@@title.user:User | Simplia`,
        ...permissioned(['users.view']),
        loadComponent: () =>
          import('./features/administration/users/pages/user-detail.page').then(
            (m) => m.UserDetailPage,
          ),
      },
      {
        path: 'administration/roles',
        title: $localize`:@@title.roles:Roles | Simplia`,
        ...permissioned(['roles.view']),
        loadComponent: () =>
          import('./features/administration/roles/pages/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'administration/roles/:id',
        title: $localize`:@@title.role:Role | Simplia`,
        ...permissioned(['roles.view']),
        loadComponent: () =>
          import('./features/administration/roles/pages/role-detail.page').then(
            (m) => m.RoleDetailPage,
          ),
      },

      // Account and status
      {
        path: 'account/profile',
        title: $localize`:@@title.accountProfile:Profile | Simplia`,
        loadComponent: () =>
          import('./features/account/pages/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'account/security',
        title: $localize`:@@title.accountSecurity:Security | Simplia`,
        loadComponent: () =>
          import('./features/account/pages/security.page').then((m) => m.SecurityPage),
      },
      {
        path: 'forbidden',
        title: $localize`:@@title.forbidden:Access denied | Simplia`,
        loadComponent: () =>
          import('./features/errors/pages/forbidden.page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: $localize`:@@title.notFound:Page not found | Simplia`,
        loadComponent: () =>
          import('./features/errors/pages/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
  { path: '**', redirectTo: 'app' },
];
