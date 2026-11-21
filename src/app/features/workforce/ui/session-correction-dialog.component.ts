import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../core/api/api-error-message';
import {
  WorkSession,
  WorkSessionCorrection,
  WorkSessionsApiService,
} from '../data-access/work-sessions-api.service';

export interface SessionCorrectionDialogData {
  readonly session: WorkSession;
}

/** Local date-time text (for datetime-local inputs) converted to an ISO instant for the API. */
function toIso(local: string): string {
  return new Date(local).toISOString();
}

function toLocalInput(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

@Component({
  selector: 'app-session-correction-dialog',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@time.correct.title">Correct this session</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="form-hint" i18n="@@time.correct.hint">
          Every correction keeps the previous times in the history below.
        </p>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@time.in">In</mat-label>
            <input matInput type="datetime-local" formControlName="clockInAt" />
            @if (form.controls.clockInAt.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@time.out">Out</mat-label>
            <input matInput type="datetime-local" formControlName="clockOutAt" />
            <mat-hint i18n="@@time.outHint">Leave empty to keep the session open.</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@time.correct.reason">Reason</mat-label>
            <input matInput formControlName="reason" maxlength="500" />
            @if (form.controls.reason.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
        </div>

        @if (history().length) {
          <h3 class="history-title" i18n="@@time.correct.history">History</h3>
          <div class="table-card">
            <table mat-table [dataSource]="history()" class="data-table">
              <ng-container matColumnDef="when">
                <th mat-header-cell *matHeaderCellDef i18n="@@time.correct.when">Corrected</th>
                <td mat-cell *matCellDef="let row">{{ row.correctedAt | date: 'medium' }}</td>
              </ng-container>
              <ng-container matColumnDef="before">
                <th mat-header-cell *matHeaderCellDef i18n="@@time.correct.before">Before</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.oldClockInAt | date: 'short' }} –
                  {{ row.oldClockOutAt ? (row.oldClockOutAt | date: 'short') : '…' }}
                </td>
              </ng-container>
              <ng-container matColumnDef="reason">
                <th mat-header-cell *matHeaderCellDef i18n="@@time.correct.reason">Reason</th>
                <td mat-cell *matCellDef="let row">{{ row.reason }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="historyColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: historyColumns"></tr>
            </table>
          </div>
        }

        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          <span i18n="@@common.save">Save</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .history-title {
      margin: 1rem 0 0.5rem;
      font: var(--mat-sys-title-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionCorrectionDialogComponent {
  readonly data = inject<SessionCorrectionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<SessionCorrectionDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(WorkSessionsApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly historyColumns = ['when', 'before', 'reason'];
  readonly history = signal<WorkSessionCorrection[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    clockInAt: [toLocalInput(this.data.session.clockInAt), [Validators.required]],
    clockOutAt: [toLocalInput(this.data.session.clockOutAt)],
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor() {
    this.api.corrections(this.data.session.id).subscribe({
      next: (history) => this.history.set(history),
      error: () => this.history.set([]),
    });
  }

  save(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const clockIn = toIso(value.clockInAt);
    const clockOut = value.clockOutAt ? toIso(value.clockOutAt) : null;
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      this.error.set(
        $localize`:@@time.correct.order:The clock-out time must be after the clock-in time.`,
      );
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api.correct(this.data.session.id, clockIn, clockOut, value.reason.trim()).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@time.correct.failed:The session could not be corrected.`,
          ),
        );
      },
    });
  }
}
