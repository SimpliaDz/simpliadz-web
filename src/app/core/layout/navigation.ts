/**
 * Sidebar structure. Only screens that exist are listed; each item declares the permissions
 * required to see it. Add an entry here in the same change that adds its route.
 */
export interface NavigationItem {
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly permissions: readonly string[];
}

export interface NavigationSection {
  readonly title: string;
  readonly items: readonly NavigationItem[];
}

export const navigationSections: readonly NavigationSection[] = [
  {
    title: $localize`:@@nav.section.overview:Overview`,
    items: [
      {
        label: $localize`:@@nav.financialDashboard:Financial dashboard`,
        icon: 'monitoring',
        path: '/app/reports/financial',
        permissions: ['reports.sales-summary.view'],
      },
      {
        label: $localize`:@@nav.dashboard:Dashboard`,
        icon: 'dashboard',
        path: '/app/dashboard',
        permissions: [],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.catalogue:Catalogue`,
    items: [
      {
        label: $localize`:@@nav.products:Products`,
        icon: 'inventory_2',
        path: '/app/catalogue/products',
        permissions: ['products.view'],
      },
      {
        label: $localize`:@@nav.brands:Brands`,
        icon: 'sell',
        path: '/app/catalogue/brands',
        permissions: ['brands.view'],
      },
      {
        label: $localize`:@@nav.categories:Categories`,
        icon: 'account_tree',
        path: '/app/catalogue/categories',
        permissions: ['categories.view'],
      },
      {
        label: $localize`:@@nav.attributes:Attributes`,
        icon: 'tune',
        path: '/app/catalogue/attributes',
        permissions: ['attributes.view'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.inventory:Inventory`,
    items: [
      {
        label: $localize`:@@nav.locations:Locations`,
        icon: 'store',
        path: '/app/inventory/locations',
        permissions: ['locations.view'],
      },
      {
        label: $localize`:@@nav.priceLists:Price lists`,
        icon: 'price_change',
        path: '/app/inventory/price-lists',
        permissions: ['price-lists.view'],
      },
      {
        label: $localize`:@@nav.stock:Stock levels`,
        icon: 'inventory',
        path: '/app/inventory/stock',
        permissions: ['stock.view'],
      },
      {
        label: $localize`:@@nav.movements:Movements`,
        icon: 'swap_vert',
        path: '/app/inventory/stock/movements',
        permissions: ['stock.view'],
      },
      {
        label: $localize`:@@nav.policies:Reorder policies`,
        icon: 'rule',
        path: '/app/inventory/stock/policies',
        permissions: ['stock.view'],
      },
      {
        label: $localize`:@@nav.transfers:Transfers`,
        icon: 'local_shipping',
        path: '/app/inventory/transfers',
        permissions: ['stock.view'],
      },
      {
        label: $localize`:@@nav.counts:Stock counts`,
        icon: 'checklist',
        path: '/app/inventory/counts',
        permissions: ['stock.view'],
      },
      {
        label: $localize`:@@nav.warnings:Warnings`,
        icon: 'notifications',
        path: '/app/inventory/warnings',
        permissions: ['inventory-warnings.view'],
      },
      {
        label: $localize`:@@nav.documents:Documents`,
        icon: 'description',
        path: '/app/inventory/documents',
        permissions: ['inventory-documents.view'],
      },
      {
        label: $localize`:@@nav.labels:Barcode labels`,
        icon: 'qr_code_2',
        path: '/app/inventory/labels',
        permissions: ['barcode-labels.view'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.sales:Sales`,
    items: [
      {
        label: $localize`:@@nav.pos:Point of Sale`,
        icon: 'point_of_sale',
        path: '/app/sales/pos',
        permissions: ['sales.manage'],
      },
      {
        label: $localize`:@@nav.salesList:Sales`,
        icon: 'point_of_sale',
        path: '/app/sales/sales',
        permissions: ['sales.view'],
      },
      {
        label: 'Promotions',
        icon: 'local_offer',
        path: '/app/sales/promotions',
        permissions: ['sales.manage', 'sales.discounts.apply'],
      },
      {
        label: $localize`:@@nav.customers:Customers`,
        icon: 'groups',
        path: '/app/sales/customers',
        permissions: ['customers.view'],
      },
      {
        label: $localize`:@@nav.loyalty:Customer loyalty`,
        icon: 'card_membership',
        path: '/app/crm/loyalty',
        permissions: ['crm.view'],
      },
      {
        label: $localize`:@@nav.registers:Cash registers`,
        icon: 'payments',
        path: '/app/sales/cash/registers',
        permissions: ['cash-registers.view'],
      },
      {
        label: $localize`:@@nav.sessions:Cash sessions`,
        icon: 'lock_open',
        path: '/app/sales/cash/sessions',
        permissions: ['cash-sessions.view'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.purchasing:Purchasing`,
    items: [
      {
        label: $localize`:@@nav.suppliers:Suppliers`,
        icon: 'contact_phone',
        path: '/app/purchasing/suppliers',
        permissions: ['suppliers.view'],
      },
      {
        label: $localize`:@@nav.orders:Purchase orders`,
        icon: 'receipt_long',
        path: '/app/purchasing/orders',
        permissions: ['purchase-orders.view'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.reports:Reports`,
    items: [
      {
        label: $localize`:@@nav.reportSales:Sales summary`,
        icon: 'bar_chart',
        path: '/app/reports/sales',
        permissions: ['reports.sales-summary.view'],
      },
      {
        label: $localize`:@@nav.reportProducts:Product performance`,
        icon: 'trending_up',
        path: '/app/reports/products',
        permissions: ['reports.product-performance.view'],
      },
      {
        label: $localize`:@@nav.reportInventory:Inventory report`,
        icon: 'inventory_2',
        path: '/app/reports/inventory',
        permissions: ['reports.inventory.view'],
      },
      {
        label: $localize`:@@nav.reportLowStock:Low stock`,
        icon: 'warning',
        path: '/app/reports/low-stock',
        permissions: ['reports.low-stock.view'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.accounting:Accounting`,
    items: [
      {
        label: $localize`:@@nav.expenses:Expenses`,
        icon: 'receipt',
        path: '/app/accounting/expenses',
        permissions: ['expenses.view', 'expense-categories.view'],
      },
      {
        label: $localize`:@@nav.expenseCategories:Expense categories`,
        icon: 'category',
        path: '/app/accounting/expense-categories',
        permissions: ['expense-categories.view'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.workforce:Workforce`,
    items: [
      {
        label: $localize`:@@nav.myTime:My time`,
        icon: 'schedule',
        path: '/app/workforce/clock',
        permissions: [],
      },
      {
        label: $localize`:@@nav.workSessions:Work sessions`,
        icon: 'event_available',
        path: '/app/workforce/sessions',
        permissions: ['work-sessions.view'],
      },
      {
        label: $localize`:@@nav.hoursReport:Hours report`,
        icon: 'summarize',
        path: '/app/workforce/report',
        permissions: ['work-sessions.report'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.business:Business`,
    items: [
      {
        label: $localize`:@@nav.organization:Organization`,
        icon: 'apartment',
        path: '/app/organization',
        permissions: ['organization.view'],
      },
      {
        label: 'Organization settings',
        icon: 'settings',
        path: '/app/organization/settings',
        permissions: ['organization.manage'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.administration:Administration`,
    items: [
      {
        label: $localize`:@@nav.users:Users`,
        icon: 'group',
        path: '/app/administration/users',
        permissions: ['users.view'],
      },
      {
        label: $localize`:@@nav.roles:Roles`,
        icon: 'shield_person',
        path: '/app/administration/roles',
        permissions: ['roles.view'],
      },
      {
        label: $localize`:@@nav.audit:Audit log`,
        icon: 'fact_check',
        path: '/app/administration/audit',
        permissions: ['audit.view'],
      },
    ],
  },
  {
    title: $localize`:@@nav.section.account:Account`,
    items: [
      {
        label: $localize`:@@nav.accountProfile:Profile`,
        icon: 'person',
        path: '/app/account/profile',
        permissions: [],
      },
      {
        label: $localize`:@@nav.accountSecurity:Security`,
        icon: 'lock',
        path: '/app/account/security',
        permissions: [],
      },
    ],
  },
];
