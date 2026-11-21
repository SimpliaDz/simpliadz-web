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
    ],
  },
  {
    title: $localize`:@@nav.section.account:Account`,
    items: [
      {
        label: $localize`:@@nav.accountSecurity:Security`,
        icon: 'lock',
        path: '/app/account/security',
        permissions: [],
      },
    ],
  },
];
