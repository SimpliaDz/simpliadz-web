import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { numberOrNull } from '../../../../shared/forms/form-values';
import { DiscountType } from '../data-access/sales-api.service';

export interface DiscountDialogData {
  readonly title: string;
  readonly type: DiscountType | null;
  readonly value: number | null;
}

export interface DiscountResult {
  readonly type: DiscountType;
  readonly value: number;
}

@Component({
  selector: 'app-discount-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@discount.type">Discount type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="FixedAmount" i18n="@@discount.fixed">Fixed amount</mat-option>
              <mat-option value="Percentage" i18n="@@discount.percent">Percentage</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@discount.value">Value</mat-label>
            <input matInput type="number" min="0" step="0.0001" formControlName="value" />
            @if (form.controls.value.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            } @else if (form.controls.value.hasError('max')) {
              <mat-error i18n="@@discount.maxPercent">A percentage cannot exceed 100.</mat-error>
            } @else if (form.controls.value.hasError('min')) {
              <mat-error i18n="@@validation.nonNegative">Use zero or a positive number.</mat-error>
            }
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Cancel</button>
        <button mat-flat-button type="submit">
          <span i18n="@@common.apply">Apply</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountDialogComponent {
  readonly data = inject<DiscountDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<DiscountDialogComponent, DiscountResult>>(MatDialogRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly form = this.formBuilder.group({
    type: this.formBuilder.control<DiscountType>(this.data.type ?? 'FixedAmount'),
    value: this.formBuilder.control<number | null>(this.data.value ?? 0, [
      Validators.required,
      Validators.min(0),
    ]),
  });

  submit(): void {
    const value = this.form.getRawValue();
    const amount = numberOrNull(value.value);
    if (amount === null || amount < 0 || (value.type === 'Percentage' && amount > 100)) {
      this.form.controls.value.setErrors({
        max: value.type === 'Percentage' && amount !== null && amount > 100,
      });
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close({ type: value.type, value: amount });
  }
}
