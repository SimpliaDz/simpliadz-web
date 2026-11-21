/**
 * Sidebar structure. Only screens that exist are listed; each item declares the permissions
 * required to see it. Add an entry here when its feature route is implemented, never before.
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
