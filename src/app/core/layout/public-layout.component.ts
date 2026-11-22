import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';

/** Layout for unauthenticated pages (sign in, password recovery). */
@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterOutlet, ThemeToggleComponent],
  template: `
    <header class="public-header">
      <a class="brand" routerLink="/"
        ><img class="brand-mark" src="graphics/brand/simpliadz-mark.svg" alt="" /> SimpliaDz</a
      >
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
      background: var(--app-content-surface);
      color: var(--mat-sys-on-surface);
    }
    .public-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 4.5rem;
      padding-inline: 2rem;
      background: color-mix(in srgb, var(--mat-sys-surface-container-lowest) 94%, transparent);
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      color: var(--mat-sys-on-surface);
      font-size: 1.1875rem;
      font-weight: 800;
      text-decoration: none;
    }
    .brand-mark {
      width: 2rem;
      height: 2rem;
      box-shadow: 0 0.25rem 0.75rem color-mix(in srgb, var(--mat-sys-primary) 18%, transparent);
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
