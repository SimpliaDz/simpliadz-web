import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { describeApiError } from '../../../../core/api/api-error-message';
import { ExpenseCategory, ExpensesApiService } from '../data-access/expenses-api.service';

export interface ExpenseCategoryDialogData {
  readonly category: ExpenseCategory | null;
}

@Component({
  selector: 'app-expense-category-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.category ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-row">
          <mat-label i18n="@@expenseCategories.field.name">Category name</mat-label>
          <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
          @if (form.controls.name.hasError('required')) {
            <mat-error i18n="@@validation.required">This field is required.</mat-error>
          }
        </mat-form-field>
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
export class ExpenseCategoryDialogComponent {
  readonly data = inject<ExpenseCategoryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ExpenseCategoryDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(ExpensesApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@expenseCategories.dialog.create:New category`;
  readonly editTitle = $localize`:@@expenseCategories.dialog.edit:Edit category`;

  readonly form = this.formBuilder.group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(150)]],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const name = this.form.getRawValue().name.trim();
    const call = this.data.category
      ? this.api.updateCategory(this.data.category.id, name)
      : this.api.createCategory(name);

    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@expenseCategories.saveFailed:The category could not be saved.`,
          ),
        );
      },
    });
  }
}
