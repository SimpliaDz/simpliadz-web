import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull, numberOrNull } from '../../../../shared/forms/form-values';
import { Location } from '../../../inventory/locations/data-access/locations-api.service';
import { Expense, ExpenseCategory, ExpensesApiService } from '../data-access/expenses-api.service';

export interface ExpenseDialogData {
  readonly expense: Expense | null;
  readonly categories: readonly ExpenseCategory[];
  readonly locations: readonly Location[];
}

@Component({
  selector: 'app-expense-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.expense ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.field.category">Category</mat-label>
            <mat-select formControlName="expenseCategoryId">
              @for (category of data.categories; track category.id) {
                <mat-option [value]="category.id" [disabled]="!category.isActive">{{
                  category.name
                }}</mat-option>
              }
            </mat-select>
            @if (form.controls.expenseCategoryId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.field.location">Location (optional)</mat-label>
            <mat-select formControlName="locationId">
              <mat-option value="" i18n="@@common.none">None</mat-option>
              @for (location of data.locations; track location.id) {
                <mat-option [value]="location.id" [disabled]="!location.isActive">{{
                  location.name
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.field.amount">Amount</mat-label>
            <input matInput type="number" min="0.0001" step="0.0001" formControlName="amount" />
            @if (
              form.controls.amount.hasError('required') || form.controls.amount.hasError('min')
            ) {
              <mat-error i18n="@@validation.positive">Enter an amount above zero.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.field.date">Date</mat-label>
            <input matInput type="date" formControlName="expenseDate" />
            @if (form.controls.expenseDate.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@expenses.field.description">Description</mat-label>
            <input matInput formControlName="description" maxlength="2000" />
          </mat-form-field>
        </div>
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseDialogComponent {
  readonly data = inject<ExpenseDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ExpenseDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(ExpensesApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@expenses.dialog.create:New expense`;
  readonly editTitle = $localize`:@@expenses.dialog.edit:Edit expense`;

  readonly form = this.formBuilder.group({
    expenseCategoryId: [this.data.expense?.expenseCategoryId ?? '', [Validators.required]],
    locationId: [this.data.expense?.locationId ?? ''],
    amount: this.formBuilder.control<number | null>(this.data.expense?.amount ?? null, [
      Validators.required,
      Validators.min(0.0001),
    ]),
    expenseDate: [
      this.data.expense?.expenseDate ?? new Date().toISOString().slice(0, 10),
      [Validators.required],
    ],
    description: [this.data.expense?.description ?? '', [Validators.maxLength(2000)]],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  save(): void {
    const value = this.form.getRawValue();
    const amount = numberOrNull(value.amount);
    if (this.form.invalid || amount === null || amount <= 0) {
      this.form.markAllAsTouched();
      return;
    }
    const request = {
      expenseCategoryId: value.expenseCategoryId,
      locationId: blankToNull(value.locationId),
      amount,
      expenseDate: value.expenseDate,
      description: blankToNull(value.description),
    };
    const call = this.data.expense
      ? this.api.update(this.data.expense.id, request)
      : this.api.create(request);

    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@expenses.saveFailed:The expense could not be saved.`,
          ),
        );
      },
    });
  }
}
