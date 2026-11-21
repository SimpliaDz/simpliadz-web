import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <section class="status">
      <mat-icon aria-hidden="true">search_off</mat-icon>
      <h1 i18n="@@status.notFound.heading">Page not found</h1>
      <p i18n="@@status.notFound.body">The page you are looking for does not exist or has moved.</p>
      <a mat-flat-button routerLink="/app/dashboard" i18n="@@status.backToDashboard"
        >Back to dashboard</a
      >
    </section>
  `,
  styles: `
    .status {
      display: grid;
      justify-items: center;
      gap: 0.75rem;
      padding-block: 3rem;
      text-align: center;
    }
    .status mat-icon {
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
      color: var(--mat-sys-primary);
    }
    .status h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .status p {
      margin: 0;
      max-width: 36rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
