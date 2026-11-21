import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';

/** Layout for unauthenticated pages (sign in, password recovery). */
@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterOutlet, ThemeToggleComponent],
  template: `
    <header class="public-header">
      <a class="brand" routerLink="/">SimpliaDz</a>
      <span
        class="tagline"
        i18n="Application tagline|A concise product description in the global header@@app.tagline"
        >Business management</span
      >
      <span class="spacer"></span>
      <app-theme-toggle />
    </header>

    <main class="public-main">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }
    .public-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 4rem;
      padding-inline: 2rem;
      background: var(--mat-sys-surface-container);
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }
    .brand {
      color: inherit;
      font-size: 1.125rem;
      font-weight: 700;
      text-decoration: none;
    }
    .tagline {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }
    .spacer {
      flex: 1;
    }
    .public-main {
      flex: 1;
      padding: 2rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayoutComponent {}
