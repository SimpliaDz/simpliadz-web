import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { describeApiError } from '../../../core/api/api-error-message';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import {
  DashboardSummary,
  ReportsApiService,
} from '../../reporting/data-access/reports-api.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [DecimalPipe, MatCardModule, MatIconModule, RouterLink],
  template: `
    <header class="page-header">
      <div>
        <h1 i18n="@@dashboard.heading">Welcome back</h1>
        <p class="page-subtitle">{{ email() }}</p>
      </div>
    </header>

    @if (canSeeToday()) {
      <h2 class="section-title" i18n="@@dashboard.today">Today</h2>
      @if (todayError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      } @else if (today(); as t) {
        <div class="card-grid">
          @if (t.salesAvailable) {
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@dashboard.revenue">Revenue</p>
                <p class="metric">{{ t.revenue | number: '1.2-2' }}</p>
                <p class="muted">
                  {{ t.transactionCount }} <span i18n="@@dashboard.sales">sales</span> ·
                  {{ t.itemsSold }} <span i18n="@@dashboard.items">items</span>
                </p>
              </mat-card-content></mat-card
            >
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@dashboard.average">Average basket</p>
                <p class="metric">{{ t.averageBasket | number: '1.2-2' }}</p>
              </mat-card-content></mat-card
            >
          }
          @if (t.salesAvailable && t.accountingAvailable) {
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@dashboard.grossProfit">Gross profit</p>
                <p class="metric">{{ t.grossProfit | number: '1.2-2' }}</p>
                <p class="muted">
                  <span i18n="@@dashboard.expensesLabel">Expenses</span>:
                  {{ t.expenses | number: '1.2-2' }}
                </p>
              </mat-card-content></mat-card
            >
          }
          @if (t.inventoryAvailable) {
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@dashboard.lowStock">Below reorder point</p>
                <p class="metric">{{ t.lowStockCount }}</p>
                <a mat-button routerLink="/app/reports/low-stock" i18n="@@dashboard.viewLowStock"
                  >View low stock</a
                >
              </mat-card-content></mat-card
            >
          }
        </div>
        @if (!t.salesAvailable || !t.inventoryAvailable) {
          <p class="form-hint" i18n="@@dashboard.unavailable">
            Some figures are unavailable because a module is switched off for this organization.
          </p>
        }
        <p class="form-hint">{{ t.date }} · {{ t.timeZone }}</p>
      } @else {
        <p class="muted" i18n="@@dashboard.loading">Loading today’s figures…</p>
      }
    }

    <h2 class="section-title" i18n="@@dashboard.access">Your access</h2>
    <div class="card-grid">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-icon mat-card-avatar aria-hidden="true">badge</mat-icon>
          <mat-card-title i18n="@@dashboard.roles.title">Your roles</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (roles().length) {
            <ul class="chip-list">
              @for (role of roles(); track role) {
                <li>{{ role }}</li>
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
    .card-grid mat-card p {
      margin: 0;
    }
    .label {
      color: var(--mat-sys-on-surface-variant);
    }
    .metric {
      font: var(--mat-sys-headline-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly session = inject(AuthSessionService);
  private readonly reports = inject(ReportsApiService);

  readonly email = computed(() => this.session.user()?.email ?? '');
  readonly roles = computed(() => this.session.user()?.roles ?? []);
  readonly permissionCount = computed(() => this.session.user()?.permissions.length ?? 0);
  readonly canSeeToday = computed(() => this.session.hasPermission('reports.dashboard.view'));
  readonly today = signal<DashboardSummary | null>(null);
  readonly todayError = signal<string | null>(null);

  constructor() {
    if (this.canSeeToday()) {
      this.reports.dashboardToday().subscribe({
        next: (summary) => this.today.set(summary),
        error: (error: unknown) =>
          this.todayError.set(
            describeApiError(
              error,
              $localize`:@@dashboard.todayFailed:Today’s figures could not be loaded.`,
            ),
          ),
      });
    }
  }
}
