import { DatePipe, DecimalPipe } from '@angular/common';
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
import {
  UserSummary,
  UsersApiService,
} from '../../administration/users/data-access/users-api.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel/state-panel.component';
import { WorkHoursReport, WorkSessionsApiService } from '../data-access/work-sessions-api.service';

@Component({
  selector: 'app-hours-report-page',
  imports: [
    DatePipe,
    DecimalPipe,
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
      subtitle="Hours worked per day, for closed sessions. Days are split at local midnight in the organization's time zone."
      i18n-subtitle="@@report.subtitle"
    />

    <form class="toolbar" (ngSubmit)="run()" role="search">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.from">From</mat-label>
        <input matInput type="date" name="from" [(ngModel)]="fromDate" required />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.to">To</mat-label>
        <input matInput type="date" name="to" [(ngModel)]="toDate" required />
      </mat-form-field>
      @if (canViewUsers()) {
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
      <button mat-flat-button type="submit" [disabled]="busy()" i18n="@@report.run">
        Run report
      </button>
    </form>

    @if (busy()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (error(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message" />
    } @else if (report(); as current) {
      <p class="total-line">
        <span i18n="@@report.total">Total</span>:
        <strong>{{ current.totalHours | number: '1.0-2' }} h</strong>
        <span class="muted"> · {{ current.timeZoneId }}</span>
      </p>
      @if (current.days.length === 0) {
        <app-state-panel icon="summarize" [title]="emptyTitle" [message]="emptyMessage" />
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="current.days" class="data-table">
            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef i18n="@@report.date">Date</th>
              <td mat-cell *matCellDef="let row">{{ row.date | date: 'mediumDate' }}</td>
            </ng-container>
            <ng-container matColumnDef="person">
              <th mat-header-cell *matHeaderCellDef i18n="@@time.person">Person</th>
              <td mat-cell *matCellDef="let row">{{ personName(row.userId) }}</td>
            </ng-container>
            <ng-container matColumnDef="hours">
              <th mat-header-cell *matHeaderCellDef i18n="@@time.hours">Hours</th>
              <td mat-cell *matCellDef="let row">{{ row.hours | number: '1.0-2' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    } @else {
      <p class="muted" i18n="@@report.prompt">Choose a date range and run the report.</p>
    }
  `,
  styles: `
    .total-line {
      text-align: end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoursReportPage {
  private readonly api = inject(WorkSessionsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly session = inject(AuthSessionService);

  readonly heading = $localize`:@@report.heading:Hours report`;
  readonly errorTitle = $localize`:@@report.failed:The report could not be run`;
  readonly emptyTitle = $localize`:@@report.empty.title:No hours in this range`;
  readonly emptyMessage = $localize`:@@report.empty.message:Closed sessions in the range will appear here.`;
  readonly columns = ['date', 'person', 'hours'];

  readonly canViewUsers = computed(() => this.session.hasPermission('users.view'));
  readonly users = signal<UserSummary[]>([]);
  readonly report = signal<WorkHoursReport | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  fromDate: string | null = null;
  toDate: string | null = null;
  userId: string | null = null;

  constructor() {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    this.fromDate = first.toISOString().slice(0, 10);
    this.toDate = today.toISOString().slice(0, 10);
    if (this.canViewUsers()) {
      this.usersApi
        .list()
        .subscribe({ next: (users) => this.users.set(users), error: () => this.users.set([]) });
    }
  }

  run(): void {
    if (!this.fromDate || !this.toDate) {
      this.error.set($localize`:@@report.dates:Choose both dates.`);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.report(this.fromDate, this.toDate, this.userId).subscribe({
      next: (report) => {
        this.report.set(report);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.report.set(null);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@report.failedHint:Check the dates. A range is limited to 366 days.`,
          ),
        );
      },
    });
  }

  personName(userId: string): string {
    const user = this.users().find((item) => item.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
  }
}
