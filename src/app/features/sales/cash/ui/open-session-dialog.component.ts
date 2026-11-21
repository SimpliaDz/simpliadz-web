import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { numberOrNull } from '../../../../shared/forms/form-values';
import { CashApiService, CashRegister, CashSession } from '../data-access/cash-api.service';

export interface OpenSessionDialogData {
  readonly registers: readonly CashRegister[];
}

@Component({
  selector: 'app-open-session-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@sessions.dialog.title">Open a cash session</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@registers.title">Cash register</mat-label>
            <mat-select formControlName="cashRegisterId">
              @for (register of data.registers; track register.id) {
                <mat-option [value]="register.id"
                  >{{ register.name }} ({{ register.code }})</mat-option
                >
              }
            </mat-select>
            @if (form.controls.cashRegisterId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@sessions.openingCash">Opening cash</mat-label>
            <input matInput type="number" min="0" step="0.0001" formControlName="openingCash" />
            @if (form.controls.openingCash.hasError('min')) {
              <mat-error i18n="@@validation.nonNegative">Use zero or a positive number.</mat-error>
            }
          </mat-form-field>
        </div>
        <p class="form-hint" i18n="@@sessions.auditNotice">
          Opening a session is recorded in the audit trail.
        </p>
        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          <span i18n="@@sessions.open">Open session</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenSessionDialogComponent {
  readonly data = inject<OpenSessionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<OpenSessionDialogComponent, CashSession>>(MatDialogRef);
  private readonly api = inject(CashApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.formBuilder.group({
    cashRegisterId: ['', [Validators.required]],
    openingCash: this.formBuilder.control<number | null>(0, [
      Validators.required,
      Validators.min(0),
    ]),
  });

  save(): void {
    const value = this.form.getRawValue();
    const opening = numberOrNull(value.openingCash);
    if (!value.cashRegisterId || opening === null || opening < 0) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.open(value.cashRegisterId, opening).subscribe({
      next: (session) => this.dialogRef.close(session),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@sessions.openFailed:The session could not be opened.`,
          ),
        );
      },
    });
  }
}
