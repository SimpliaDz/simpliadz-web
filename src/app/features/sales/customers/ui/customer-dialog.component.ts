import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull } from '../../../../shared/forms/form-values';
import { Customer, CustomersApiService, CustomerType } from '../data-access/customers-api.service';

export interface CustomerDialogData {
  readonly customer: Customer | null;
}

@Component({
  selector: 'app-customer-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.customer ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@customers.field.name">Customer name</mat-label>
            <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
            @if (form.controls.name.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@customers.field.type">Customer type</mat-label>
            <mat-select formControlName="customerType">
              <mat-option value="Retail" i18n="@@priceLists.type.retail">Retail</mat-option>
              <mat-option value="Wholesale" i18n="@@priceLists.type.wholesale"
                >Wholesale</mat-option
              >
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@customers.field.phone">Phone</mat-label>
            <input matInput formControlName="phone" maxlength="50" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@customers.field.email">Email</mat-label>
            <input matInput type="email" formControlName="email" maxlength="254" />
            @if (form.controls.email.hasError('email')) {
              <mat-error i18n="@@validation.email">Enter a valid email address.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@customers.field.address">Address</mat-label>
            <input matInput formControlName="address" maxlength="500" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@customers.field.notes">Notes</mat-label>
            <textarea matInput formControlName="notes" rows="3" maxlength="2000"></textarea>
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
export class CustomerDialogComponent {
  readonly data = inject<CustomerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CustomerDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(CustomersApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@customers.dialog.create:New customer`;
  readonly editTitle = $localize`:@@customers.dialog.edit:Edit customer`;

  readonly form = this.formBuilder.group({
    name: [this.data.customer?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    customerType: this.formBuilder.control<CustomerType>(
      this.data.customer?.customerType ?? 'Retail',
    ),
    phone: [this.data.customer?.phone ?? '', [Validators.maxLength(50)]],
    email: [this.data.customer?.email ?? '', [Validators.email, Validators.maxLength(254)]],
    address: [this.data.customer?.address ?? '', [Validators.maxLength(500)]],
    notes: [this.data.customer?.notes ?? '', [Validators.maxLength(2000)]],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      customerType: value.customerType,
      phone: blankToNull(value.phone),
      email: blankToNull(value.email),
      address: blankToNull(value.address),
      notes: blankToNull(value.notes),
    };
    const call = this.data.customer
      ? this.api.update(this.data.customer.id, request)
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
            $localize`:@@customers.saveFailed:We could not save the customer.`,
          ),
        );
      },
    });
  }
}
