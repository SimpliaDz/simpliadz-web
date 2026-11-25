import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../core/api/api-error-message';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel/state-panel.component';
import {
  UserSummary,
  UsersApiService,
} from '../../administration/users/data-access/users-api.service';
import { AuditApiService, AuditEntry } from '../data-access/audit-api.service';

const pageSize = 50;

/** Actions written by the backend today. Free text is still accepted by the API. */
const actions = [
  'UserDeactivated',
  'VariantIdentifiersUpdated',
  'PriceChanged',
  'StockAdjusted',
  'InventoryCountCompleted',
  'GoodsReceived',
  'SaleCancelled',
  'CashSessionOpened',
  'CashSessionClosed',
  'CashMoved',
  'WorkSessionCorrected',
  'WorkSessionClockedIn',
  'WorkSessionClockedOut',
  'CashRegisterSelected',
  'CashRegisterReleased',
] as const;

@Component({
  selector: 'app-audit-log-page',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="A read-only record of sensitive changes: adjustments, counts, prices, sessions and deactivations."
      i18n-subtitle="@@audit.subtitle"
    />

    <form class="toolbar" (ngSubmit)="apply()" role="search">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@audit.action">Action</mat-label>
        <mat-select name="action" [(ngModel)]="action">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (item of actionOptions; track item) {
            <mat-option [value]="item">{{ actionLabel(item) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (users().length) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@time.person">Person</mat-label>
          <mat-select name="user" [(ngModel)]="userId">
            <mat-option [value]="null" i18n="@@common.all">Everyone</mat-option>
            @for (user of users(); track user.id) {
              <mat-option [value]="user.id">{{ user.firstName }} {{ user.lastName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      <mat-form-field appearance="outline">
        <mat-label i18n="@@audit.entityType">Entity type</mat-label>
        <input matInput name="entityType" [(ngModel)]="entityType" maxlength="100" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.from">From</mat-label>
        <input matInput type="datetime-local" name="from" [(ngModel)]="from" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.to">To</mat-label>
        <input matInput type="datetime-local" name="to" [(ngModel)]="to" />
      </mat-form-field>
      <button mat-stroked-button type="submit" i18n="@@common.apply">Apply</button>
    </form>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (entries().length === 0) {
      <app-state-panel icon="fact_check" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <p class="total-line">
        <span i18n="@@audit.total">Entries</span>: <strong>{{ total() }}</strong>
      </p>
      <div class="table-card">
        <table mat-table [dataSource]="entries()" class="data-table">
          <ng-container matColumnDef="when">
            <th mat-header-cell *matHeaderCellDef i18n="@@movements.when">When</th>
            <td mat-cell *matCellDef="let row">{{ row.timestamp | date: 'medium' }}</td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef i18n="@@audit.action">Action</th>
            <td mat-cell *matCellDef="let row">{{ actionDescription(row) }}</td>
          </ng-container>
          <ng-container matColumnDef="entity">
            <th mat-header-cell *matHeaderCellDef i18n="@@audit.entity">Entity</th>
            <td mat-cell *matCellDef="let row" class="muted">
              {{ row.entityType }} · {{ row.entityId }}
            </td>
          </ng-container>
          <ng-container matColumnDef="who">
            <th mat-header-cell *matHeaderCellDef i18n="@@time.person">Person</th>
            <td mat-cell *matCellDef="let row">{{ row.actorName ?? personName(row.userId) }}</td>
          </ng-container>
          <ng-container matColumnDef="changes">
            <th mat-header-cell *matHeaderCellDef i18n="@@audit.changes">Changes</th>
            <td mat-cell *matCellDef="let row">
              <button
                mat-button
                type="button"
                (click)="toggle(row.id)"
                [attr.aria-expanded]="isOpen(row.id)"
              >
                <span>{{ isOpen(row.id) ? hideLabel : showLabel }}</span>
              </button>
              @if (isOpen(row.id)) {
                <pre class="changes">{{ changesText(row) }}</pre>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
      <nav class="pager" aria-label="Pagination" i18n-aria-label="@@pager.label">
        <button
          mat-stroked-button
          type="button"
          [disabled]="page() <= 1"
          (click)="goTo(page() - 1)"
          i18n="@@pager.previous"
        >
          Previous
        </button>
        <span class="muted"
          ><span i18n="@@pager.page">Page</span> {{ page() }} / {{ pageCount() }}</span
        >
        <button
          mat-stroked-button
          type="button"
          [disabled]="page() >= pageCount()"
          (click)="goTo(page() + 1)"
          i18n="@@pager.next"
        >
          Next
        </button>
      </nav>
    }
  `,
  styles: `
    .total-line {
      text-align: end;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-block-start: 1rem;
    }
    .changes {
      max-width: 40rem;
      white-space: pre-wrap;
      word-break: break-word;
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPage {
  private readonly api = inject(AuditApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly session = inject(AuthSessionService);

  readonly heading = $localize`:@@audit.heading:Audit log`;
  readonly errorTitle = $localize`:@@audit.loadFailed:We could not load the audit log`;
  readonly emptyTitle = $localize`:@@audit.empty.title:No entries match`;
  readonly emptyMessage = $localize`:@@audit.empty.message:Try a wider date range or a different action.`;
  readonly showLabel = $localize`:@@audit.show:Show`;
  readonly hideLabel = $localize`:@@audit.hide:Hide`;
  readonly columns = ['when', 'who', 'action', 'changes'];
  readonly actionOptions = actions;

  readonly canViewUsers = computed(() => this.session.hasPermission('users.view'));
  readonly entries = signal<AuditEntry[]>([]);
  readonly total = signal(0);
  readonly users = signal<UserSummary[]>([]);
  readonly page = signal(1);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / pageSize)));
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  private readonly open = signal<ReadonlySet<string>>(new Set());

  action: string | null = null;
  userId: string | null = null;
  entityType = '';
  from = '';
  to = '';
  private active = {
    action: null as string | null,
    userId: null as string | null,
    entityType: null as string | null,
    from: null as string | null,
    to: null as string | null,
  };

  constructor() {
    if (this.canViewUsers()) {
      this.usersApi
        .list()
        .subscribe({ next: (users) => this.users.set(users), error: () => this.users.set([]) });
    }
    this.load();
  }

  apply(): void {
    this.active = {
      action: this.action,
      userId: this.userId,
      entityType: this.entityType.trim() || null,
      from: this.from ? new Date(this.from).toISOString() : null,
      to: this.to ? new Date(this.to).toISOString() : null,
    };
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.entries({ ...this.active, entityId: null, page: this.page(), pageSize }).subscribe({
      next: (history) => {
        this.entries.set(history.items);
        this.total.set(history.totalItems);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@audit.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  toggle(id: string): void {
    this.open.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  isOpen(id: string): boolean {
    return this.open().has(id);
  }

  changesText(row: AuditEntry): string {
    const before = row.oldValues ? `Before:\n${pretty(row.oldValues)}` : '';
    const after = row.newValues ? `After:\n${pretty(row.newValues)}` : '';
    return [`${row.entityType} · ${row.entityId}`, before, after].filter(Boolean).join('\n\n');
  }

  actionLabel(action: string): string {
    switch (action) {
      case 'WorkSessionClockedIn': return 'Clocked in';
      case 'WorkSessionClockedOut': return 'Clocked out';
      case 'CashRegisterSelected': return 'Selected register';
      case 'CashRegisterReleased': return 'Released register';
      default: return action.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    }
  }

  actionDescription(row: AuditEntry): string {
    const label = this.actionLabel(row.action);
    if (!row.newValues || !['CashRegisterSelected', 'CashRegisterReleased'].includes(row.action)) {
      return label;
    }
    try {
      const values = JSON.parse(row.newValues);
      const register = [values?.registerCode, values?.registerName]
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
      return [label, [...new Set(register)].join(' · ')].filter(Boolean).join(' ');
    } catch {
      return label;
    }
  }

  personName(userId: string): string {
    const user = this.users().find((item) => item.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
  }
}

function pretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
