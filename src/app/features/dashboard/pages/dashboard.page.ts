import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthSessionService } from '../../../core/auth/auth-session.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [MatCardModule, MatIconModule],
  template: `
    <header class="page-header">
      <h1 i18n="@@dashboard.heading">Welcome back</h1>
      <p class="page-subtitle">{{ email() }}</p>
    </header>

    <div class="cards">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-icon mat-card-avatar aria-hidden="true">badge</mat-icon>
          <mat-card-title i18n="@@dashboard.roles.title">Your roles</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (roles().length) {
            <ul class="chips">
              @for (role of roles(); track role) {
                <li class="chip">{{ role }}</li>
              }
            </ul>
          } @else {
            <p class="muted" i18n="@@dashboard.roles.empty">
              No roles are assigned to your account.
            </p>
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-icon mat-card-avatar aria-hidden="true">verified_user</mat-icon>
          <mat-card-title i18n="@@dashboard.permissions.title">Permissions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="metric" aria-live="polite">{{ permissionCount() }}</p>
          <p class="muted" i18n="@@dashboard.permissions.help">
            Permissions granted to your account. Screens you cannot use are hidden from the menu.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .page-header {
      margin-block-end: 1.5rem;
    }
    .page-header h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
    }
    .page-subtitle {
      margin: 0.25rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .cards {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chip {
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-large);
    }
    .metric {
      margin: 0;
      font: var(--mat-sys-display-small);
      color: var(--mat-sys-primary);
    }
    .muted {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly session = inject(AuthSessionService);

  readonly email = computed(() => this.session.user()?.email ?? '');
  readonly roles = computed(() => this.session.user()?.roles ?? []);
  readonly permissionCount = computed(() => this.session.user()?.permissions.length ?? 0);
}
