import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { describeApiError } from '../../../core/api/api-error-message';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import {
  UserSummary,
  UsersApiService,
} from '../../administration/users/data-access/users-api.service';
import { PagerComponent } from '../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel/state-panel.component';
import { WorkSession, WorkSessionsApiService } from '../data-access/work-sessions-api.service';
import {
  SessionCorrectionDialogComponent,
  SessionCorrectionDialogData,
} from '../ui/session-correction-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-work-sessions-page',
  imports: [
    DatePipe,
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    RouterLink,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Everyone's clock-in and clock-out times. Corrections keep the earlier values in the history."
      i18n-subtitle="@@workSessions.subtitle"
    >
      <a
        *appHasPermission="'work-sessions.report'"
        mat-stroked-button
        routerLink="/app/workforce/report"
      >
        <mat-icon aria-hidden="true">summarize</mat-icon>
        <span i18n="@@time.report.link">Hours report</span>
      </a>
    </app-page-header>

    <form class="toolbar" (ngSubmit)="applyFilters()" role="search">
      @if (canViewUsers()) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@time.person">Person</mat-label>
          <mat-select name="user" [(ngModel)]="userId">
            <mat-option [value]="null" i18n="@@common.all">All</mat-option>
            @for (user of users(); track user.id) {
              <mat-option [value]="user.id">{{ user.firstName }} {{ user.lastName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.from">From</mat-label>
        <input matInput type="date" name="from" [(ngModel)]="fromDate" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.to">To</mat-label>
        <input matInput type="date" name="to" [(ngModel)]="toDate" />
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
    } @else if (sessions().length === 0) {
      <app-state-panel icon="schedule" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="sessions()" class="data-table">
          <ng-container matColumnDef="person">
            <th mat-header-cell *matHeaderCellDef i18n="@@time.person">Person</th>
            <td mat-cell *matCellDef="let row">{{ personName(row.userId) }}</td>
          </ng-container>
          <ng-container matColumnDef="in">
            <th mat-header-cell *matHeaderCellDef i18n="@@time.in">In</th>
            <td mat-cell *matCellDef="let row">{{ row.clockInAt | date: 'medium' }}</td>
          </ng-container>
          <ng-container matColumnDef="out">
            <th mat-header-cell *matHeaderCellDef i18n="@@time.out">Out</th>
            <td mat-cell *matCellDef="let row">
              {{ row.clockOutAt ? (row.clockOutAt | date: 'medium') : openLabel }}
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button
                *appHasPermission="'work-sessions.manage'"
                mat-icon-button
                type="button"
                (click)="correct(row)"
                [attr.aria-label]="correctLabel"
              >
                <mat-icon aria-hidden="true">edit_calendar</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
      <app-pager [page]="page()" [hasNext]="hasNext()" (pageChange)="goTo($event)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkSessionsPage {
  private readonly api = inject(WorkSessionsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@workSessions.heading:Work sessions`;
  readonly errorTitle = $localize`:@@workSessions.loadFailed:We could not load work sessions`;
  readonly emptyTitle = $localize`:@@workSessions.empty.title:No sessions match`;
  readonly emptyMessage = $localize`:@@workSessions.empty.message:Try a different date range or person.`;
  readonly openLabel = $localize`:@@time.open:Open`;
  readonly correctLabel = $localize`:@@workSessions.correct.action:Correct session`;
  readonly columns = ['person', 'in', 'out', 'actions'];

  readonly canViewUsers = computed(() => this.session.hasPermission('users.view'));
  readonly sessions = signal<WorkSession[]>([]);
  readonly users = signal<UserSummary[]>([]);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  userId: string | null = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  private active = {
    userId: null as string | null,
    fromDate: null as string | null,
    toDate: null as string | null,
  };

  constructor() {
    if (this.canViewUsers()) {
      this.usersApi
        .list()
        .subscribe({ next: (users) => this.users.set(users), error: () => this.users.set([]) });
    }
    this.load();
  }

  applyFilters(): void {
    this.active = { userId: this.userId, fromDate: this.fromDate, toDate: this.toDate };
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
    this.api.list({ ...this.active, page: this.page(), pageSize }).subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.hasNext.set(sessions.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@workSessions.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  correct(row: WorkSession): void {
    const data: SessionCorrectionDialogData = { session: row };
    this.dialog
      .open(SessionCorrectionDialogComponent, { data, width: '40rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open(
            $localize`:@@workSessions.correct.saved:Session corrected.`,
            undefined,
            { duration: 3000 },
          );
          this.load();
        }
      });
  }

  personName(userId: string): string {
    const user = this.users().find((item) => item.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
  }
}
