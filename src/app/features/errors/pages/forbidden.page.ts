import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <section class="status" role="alert">
      <mat-icon aria-hidden="true">lock</mat-icon>
      <h1 i18n="@@status.forbidden.heading">You do not have access to this page</h1>
      <p i18n="@@status.forbidden.body">
        Ask an administrator if you need access. Your menu shows the screens available to you.
      </p>
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
export class ForbiddenPage {}
