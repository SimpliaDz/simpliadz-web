import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
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
  imports: [DecimalPipe, MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  template: `
    <section class="dashboard-overview">
      <header class="dashboard-hero">
        <div class="dashboard-hero__content">
          <p class="dashboard-hero__eyebrow" i18n="@@dashboard.today">Today</p>
          <h1 i18n="@@dashboard.heading">Welcome back</h1>
          <p class="page-subtitle">{{ email() }}</p>
          @if (today(); as t) {
            <p class="dashboard-hero__date">{{ t.date }} · {{ t.timeZone }}</p>
          }
        </div>
        <img
          class="dashboard-hero__art"
          src="graphics/illustrations/operations-overview.svg"
          alt=""
          aria-hidden="true"
        />
      </header>

      @if (canSeeToday()) {
        @if (todayError(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        } @else if (today(); as t) {
          <section class="dashboard-metrics" aria-labelledby="today-metrics-title">
            <h2 id="today-metrics-title" class="visually-hidden" i18n="@@dashboard.today">Today</h2>
            @if (t.salesAvailable) {
              <mat-card appearance="outlined" class="metric-card metric-card--revenue"
                ><mat-card-content>
                  <div class="metric-card__top">
                    <p class="label" i18n="@@dashboard.revenue">Revenue</p>
                    <mat-icon aria-hidden="true">payments</mat-icon>
                  </div>
                  <p class="metric">{{ t.revenue | number: '1.2-2' }}</p>
                  <p class="muted">
                    {{ t.transactionCount }} <span i18n="@@dashboard.sales">sales</span> ·
                    {{ t.itemsSold }} <span i18n="@@dashboard.items">items</span>
                  </p>
                </mat-card-content></mat-card
              >
              <mat-card appearance="outlined" class="metric-card"
                ><mat-card-content>
                  <div class="metric-card__top">
                    <p class="label" i18n="@@dashboard.average">Average basket</p>
                    <mat-icon aria-hidden="true">shopping_bag</mat-icon>
                  </div>
                  <p class="metric">{{ t.averageBasket | number: '1.2-2' }}</p>
                </mat-card-content></mat-card
              >
            }
            @if (t.salesAvailable && t.accountingAvailable) {
              <mat-card appearance="outlined" class="metric-card"
                ><mat-card-content>
                  <div class="metric-card__top">
                    <p class="label" i18n="@@dashboard.grossProfit">Gross profit</p>
                    <mat-icon aria-hidden="true">trending_up</mat-icon>
                  </div>
                  <p class="metric">{{ t.grossProfit | number: '1.2-2' }}</p>
                  <p class="muted">
                    <span i18n="@@dashboard.expensesLabel">Expenses</span>:
                    {{ t.expenses | number: '1.2-2' }}
                  </p>
                </mat-card-content></mat-card
              >
            }
            @if (t.inventoryAvailable) {
              <mat-card appearance="outlined" class="metric-card"
                ><mat-card-content>
                  <div class="metric-card__top">
                    <p class="label" i18n="@@dashboard.lowStock">Below reorder point</p>
                    <mat-icon aria-hidden="true">inventory</mat-icon>
                  </div>
                  <p class="metric">{{ t.lowStockCount }}</p>
                  <a mat-button routerLink="/app/reports/low-stock" i18n="@@dashboard.viewLowStock"
                    >View low stock</a
                  >
                </mat-card-content></mat-card
              >
            }
          </section>
          @if (!t.salesAvailable || !t.inventoryAvailable) {
            <p class="form-hint dashboard-note" i18n="@@dashboard.unavailable">
              Some figures are unavailable because a module is switched off for this organization.
            </p>
          }
        } @else {
          <p class="muted dashboard-loading" i18n="@@dashboard.loading">Loading today’s figures…</p>
        }
      }
    </section>

    <h2 class="section-title" i18n="@@dashboard.access">Your access</h2>
    <div class="card-grid access-grid">
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
    .dashboard-overview {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(22rem, 0.8fr);
      gap: 1.25rem;
      align-items: stretch;
    }
    .dashboard-hero {
      position: relative;
      display: flex;
      min-height: 18rem;
      overflow: hidden;
      align-items: flex-start;
      padding: clamp(1.5rem, 3vw, 2.5rem);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--app-card-radius);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--mat-sys-primary) 8%, var(--app-raised-surface)), var(--app-raised-surface) 60%),
        var(--app-raised-surface);
      box-shadow: var(--app-card-shadow);
    }
    .dashboard-hero__content {
      position: relative;
      z-index: 1;
      max-width: 18rem;
    }
    .dashboard-hero h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .dashboard-hero__eyebrow {
      margin: 0 0 0.625rem;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .page-subtitle {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .dashboard-hero__date {
      margin: 1.5rem 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .dashboard-hero__art {
      position: absolute;
      inset-inline-end: -3rem;
      bottom: -1.25rem;
      width: min(58%, 28rem);
      height: auto;
      opacity: 0.95;
      pointer-events: none;
    }
    .dashboard-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.25rem;
    }
    .metric-card p {
      margin: 0;
    }
    .metric-card {
      min-height: 8.375rem;
      overflow: hidden;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .metric-card:hover {
      transform: translateY(-0.2rem);
      box-shadow: 0 0.75rem 1.75rem color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
    .metric-card--revenue {
      background: linear-gradient(135deg, color-mix(in srgb, var(--mat-sys-primary) 7%, var(--app-raised-surface)), var(--app-raised-surface)) !important;
    }
    .metric-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .metric-card__top mat-icon {
      display: grid;
      width: 2.5rem;
      height: 2.5rem;
      place-items: center;
      border-radius: 0.625rem;
      color: var(--mat-sys-primary);
      background: var(--app-soft-primary);
    }
    .label {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
    }
    .metric {
      font: var(--mat-sys-headline-small);
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .dashboard-note,
    .dashboard-loading {
      grid-column: 1 / -1;
      margin: 0;
    }
    .access-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-width: 48rem;
    }
    @media (max-width: 1099.98px) {
      .dashboard-overview {
        grid-template-columns: 1fr;
      }
      .dashboard-hero {
        min-height: 15rem;
      }
    }
    @media (max-width: 899.98px) {
      .dashboard-hero__art {
        inset-inline-end: -1rem;
        width: min(48%, 23rem);
      }
    }
    @media (max-width: 719.98px) {
      .dashboard-metrics,
      .access-grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 599.98px) {
      .dashboard-hero {
        min-height: 13.5rem;
      }
      .dashboard-hero__art {
        inset-inline-end: -5.5rem;
        width: 20rem;
        opacity: 0.45;
      }
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
