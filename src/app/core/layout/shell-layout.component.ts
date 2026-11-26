import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';
import { NavigationSection, navigationSections } from './navigation';

/** Layout for every authenticated screen: toolbar, permission-filtered sidebar, content. */
@Component({
  selector: 'app-shell-layout',
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ThemeToggleComponent,
  ],
  template: `
    <mat-toolbar class="shell-toolbar">
      <button
        mat-icon-button
        type="button"
        aria-controls="app-navigation"
        [attr.aria-expanded]="navOpen()"
        i18n-aria-label="Toggle navigation@@shell.toggleNavigation"
        aria-label="Toggle navigation"
        (click)="navOpen.set(!navOpen())"
      >
        <mat-icon aria-hidden="true">menu</mat-icon>
      </button>
      <a class="brand" routerLink="/app/dashboard">
        <img class="brand-mark" src="graphics/brand/simplia-wear-mark.svg" alt="" />
        <span>SimpliaWear</span>
      </a>
      <span class="spacer"></span>
      @if (posShortcut(); as pos) {
        <a mat-icon-button [routerLink]="pos.path" [matTooltip]="pos.label" [attr.aria-label]="pos.label">
          <mat-icon aria-hidden="true">{{ pos.icon }}</mat-icon>
        </a>
      }
      <a
        mat-icon-button
        routerLink="/app/workforce/clock"
        [matTooltip]="myTimeLabel"
        [attr.aria-label]="myTimeLabel"
      >
        <mat-icon aria-hidden="true">schedule</mat-icon>
      </a>
      <app-theme-toggle />
      <button
        mat-button
        type="button"
        class="user-button"
        [matMenuTriggerFor]="userMenu"
        i18n-aria-label="Open user menu@@shell.userMenu"
        aria-label="Open user menu"
      >
        <mat-icon aria-hidden="true">account_circle</mat-icon>
        <span class="user-email">{{ email() }}</span>
      </button>
    </mat-toolbar>

    <mat-menu #userMenu="matMenu">
      <div class="menu-identity">
        <span class="menu-email">{{ email() }}</span>
        @if (roles().length) {
          <span class="menu-roles">{{ roles().join(', ') }}</span>
        }
      </div>
      <mat-divider />
      <a mat-menu-item routerLink="/app/account/profile">
        <mat-icon aria-hidden="true">person</mat-icon>
        <span i18n="@@nav.accountProfile">Profile</span>
      </a>
      <a mat-menu-item routerLink="/app/account/security">
        <mat-icon aria-hidden="true">lock</mat-icon>
        <span i18n="@@nav.accountSecurity">Security</span>
      </a>
      <button mat-menu-item type="button" (click)="signOut()">
        <mat-icon aria-hidden="true">logout</mat-icon>
        <span i18n="@@shell.signOut">Sign out</span>
      </button>
    </mat-menu>

    <mat-sidenav-container class="shell-container">
      <mat-sidenav
        id="app-navigation"
        class="shell-nav"
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="navOpen()"
        (openedChange)="navOpen.set($event)"
      >
        <nav aria-label="Main" i18n-aria-label="Main navigation@@shell.mainNavigation">
          @for (section of sections(); track section.title) {
            <h2 class="nav-section">{{ section.title }}</h2>
            <mat-nav-list>
              @for (item of section.items; track item.path) {
                <a
                  mat-list-item
                  class="nav-item"
                  [routerLink]="item.path"
                  routerLinkActive="nav-item--active"
                  (click)="onNavigate()"
                >
                  <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
                  <span matListItemTitle>{{ item.label }}</span>
                </a>
              }
            </mat-nav-list>
          }
        </nav>
      </mat-sidenav>

      <mat-sidenav-content class="shell-content">
        <main class="shell-main">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--app-content-surface);
      color: var(--mat-sys-on-surface);
    }
    .shell-toolbar {
      position: sticky;
      top: 0;
      z-index: 4;
      min-height: 4.5rem;
      gap: 0.625rem;
      padding-inline: 1.25rem;
      background: color-mix(in srgb, var(--mat-sys-surface-container-lowest) 94%, transparent);
      border-block-end: 1px solid var(--mat-sys-outline-variant);
      box-shadow: 0 0.125rem 0.75rem color-mix(in srgb, var(--mat-sys-shadow) 5%, transparent);
      backdrop-filter: blur(1rem);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      color: var(--mat-sys-on-surface);
      font-size: 1.1875rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      text-decoration: none;
      margin-inline-start: 0.25rem;
    }
    .brand-mark {
      width: 2rem;
      height: 2rem;
      box-shadow: 0 0.25rem 0.75rem color-mix(in srgb, var(--mat-sys-primary) 18%, transparent);
    }
    .spacer {
      flex: 1;
    }
    .user-button {
      color: var(--mat-sys-on-surface);
      max-width: 16rem;
      border-radius: 0.625rem;
      background: var(--app-soft-primary);
    }
    .user-email {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-inline-start: 0.25rem;
    }
    .menu-identity {
      display: grid;
      padding: 0.75rem 1rem;
      gap: 0.125rem;
    }
    .menu-email {
      font-weight: 500;
    }
    .menu-roles {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.8125rem;
    }
    .shell-container {
      flex: 1;
      min-width: 0;
      background: transparent;
    }
    .shell-nav {
      width: 16.25rem;
      padding-block: 1.25rem;
      background: var(--mat-sys-surface-container-lowest);
      border-inline-end: 1px solid var(--mat-sys-outline-variant);
    }
    .nav-section {
      margin: 1.25rem 0 0.375rem;
      padding-inline: 1.5rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .nav-item {
      min-height: 2.875rem;
      margin-inline: 0.875rem;
      border-radius: 0.625rem;
      transition: background-color 150ms ease, color 150ms ease, transform 150ms ease;
    }
    .nav-item:hover {
      background: var(--app-soft-primary);
      transform: translateX(0.125rem);
    }
    :host-context([dir='rtl']) .nav-item:hover {
      transform: translateX(-0.125rem);
    }
    .nav-item--active {
      background: var(--app-soft-primary);
      color: var(--mat-sys-primary);
      font-weight: 600;
      /* Logical property: the indicator sits on the trailing edge in both LTR and RTL. */
      border-inline-end: 3px solid var(--mat-sys-primary);
    }
    .shell-content {
      min-width: 0;
      overflow-x: clip;
    }
    .shell-main {
      box-sizing: border-box;
      inline-size: 100%;
      max-inline-size: 100rem;
      min-width: 0;
      margin: 0 auto;
      padding: 2.25rem 1.75rem 3rem;
    }
    @media (max-width: 1439.98px) {
      .shell-toolbar {
        padding-inline: 1rem;
      }
      .shell-main {
        padding: 1.75rem 1.5rem 2.75rem;
      }
    }
    @media (max-width: 899.98px) {
      .shell-main {
        padding: 1.5rem 1.25rem 2.5rem;
      }
    }
    @media (max-width: 599.98px) {
      .user-email {
        display: none;
      }
      .shell-main {
        padding: 1.5rem 1rem 2.5rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellLayoutComponent {
  readonly myTimeLabel = $localize`:@@nav.myTime:My time`;
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  /** Preserve usable page width on typical laptops by overlaying the wide navigation below 1440px. */
  readonly isHandset = toSignal(
    this.breakpoints.observe('(max-width: 1439.98px)').pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  readonly navOpen = linkedSignal(() => !this.isHandset());

  readonly email = computed(() => this.session.user()?.email ?? '');
  readonly roles = computed(() => this.session.user()?.roles ?? []);

  readonly sections = computed<readonly NavigationSection[]>(() =>
    navigationSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => this.session.hasAllPermissions(item.permissions)),
      }))
      .filter((section) => section.items.length > 0),
  );

  readonly posShortcut = computed(() =>
    this.sections()
      .flatMap((section) => section.items)
      .find((item) => item.path === '/app/sales/pos'),
  );

  onNavigate(): void {
    if (this.isHandset()) {
      this.navOpen.set(false);
    }
  }

  signOut(): void {
    this.session.logout().subscribe();
    void this.router.navigateByUrl('/login');
  }
}
