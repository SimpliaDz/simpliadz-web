import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../core/api/api-error-message';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel/state-panel.component';
import { WorkSession, WorkSessionsApiService } from '../data-access/work-sessions-api.service';

const pageSize = 50;

@Component({
  selector: 'app-my-time-page',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Clock in when you start work and out when you finish. You can only close your own session."
      i18n-subtitle="@@time.subtitle"
    />

    <div class="card-grid">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title i18n="@@time.now">Right now</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (openSession(); as open) {
            <p class="metric">
              <span i18n="@@time.clockedInAt">Clocked in at</span>
              <strong>{{ open.clockInAt | date: 'shortTime' }}</strong>
            </p>
            <button mat-flat-button type="button" [disabled]="busy()" (click)="clockOut(open)">
              <mat-icon aria-hidden="true">logout</mat-icon>
              <span i18n="@@time.clockOut">Clock out</span>
            </button>
          } @else {
            <p class="muted" i18n="@@time.notClockedIn">You are not clocked in.</p>
            <button mat-flat-button type="button" [disabled]="busy()" (click)="clockIn()">
              <mat-icon aria-hidden="true">login</mat-icon>
              <span i18n="@@time.clockIn">Clock in</span>
            </button>
          }
          @if (actionError(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }
        </mat-card-content>
      </mat-card>
    </div>

    <h2 class="section-title" i18n="@@time.recent">Recent sessions</h2>
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
      <p class="total-line">
        <span i18n="@@time.total">Total in this list</span>:
        <strong>{{ totalHours() | number: '1.0-2' }} h</strong>
      </p>
      <div class="table-card">
        <table mat-table [dataSource]="sessions()" class="data-table">
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
          <ng-container matColumnDef="hours">
            <th mat-header-cell *matHeaderCellDef i18n="@@time.hours">Hours</th>
            <td mat-cell *matCellDef="let row">{{ hoursOf(row) | number: '1.0-2' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
  styles: `
    .metric {
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-medium);
    }
    .total-line {
      text-align: end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTimePage {
  private readonly api = inject(WorkSessionsApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@time.heading:My time`;
  readonly errorTitle = $localize`:@@time.loadFailed:We could not load your sessions`;
  readonly emptyTitle = $localize`:@@time.empty.title:No sessions yet`;
  readonly emptyMessage = $localize`:@@time.empty.message:Clock in to start recording your hours.`;
  readonly openLabel = $localize`:@@time.open:Open`;
  readonly columns = ['in', 'out', 'hours'];

  readonly sessions = signal<WorkSession[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly openSession = computed(
    () => this.sessions().find((session) => session.clockOutAt === null) ?? null,
  );
  readonly totalHours = computed(() =>
    this.sessions().reduce((sum, session) => sum + this.hoursOf(session), 0),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.mine(null, null, { page: 1, pageSize }).subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@time.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  clockIn(): void {
    this.busy.set(true);
    this.actionError.set(null);
    this.api.clockIn().subscribe({
      next: () => {
        this.busy.set(false);
        this.snackBar.open($localize`:@@time.clockedIn:Clocked in.`, undefined, { duration: 3000 });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(error, $localize`:@@time.clockInFailed:You could not clock in.`),
        );
      },
    });
  }

  clockOut(session: WorkSession): void {
    this.busy.set(true);
    this.actionError.set(null);
    this.api.clockOut(session.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.snackBar.open($localize`:@@time.clockedOut:Clocked out.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(error, $localize`:@@time.clockOutFailed:You could not clock out.`),
        );
      },
    });
  }

  hoursOf(session: WorkSession): number {
    if (!session.clockOutAt) {
      return 0;
    }
    return (
      (new Date(session.clockOutAt).getTime() - new Date(session.clockInAt).getTime()) / 3_600_000
    );
  }
}
