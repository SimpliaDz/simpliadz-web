import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull } from '../../../../shared/forms/form-values';
import { Location } from '../../../inventory/locations/data-access/locations-api.service';
import { Supplier } from '../../suppliers/data-access/suppliers-api.service';
import {
  PurchaseOrder,
  PurchaseOrdersApiService,
} from '../data-access/purchase-orders-api.service';

export interface PurchaseOrderDialogData {
  readonly suppliers: readonly Supplier[];
  readonly locations: readonly Location[];
}

@Component({
  selector: 'app-purchase-order-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@orders.dialog.title">New purchase order</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@orders.field.supplier">Supplier</mat-label>
            <mat-select formControlName="supplierId">
              @for (supplier of data.suppliers; track supplier.id) {
                <mat-option [value]="supplier.id">{{ supplier.name }}</mat-option>
              }
            </mat-select>
            @if (form.controls.supplierId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@orders.field.destination">Receive into</mat-label>
            <mat-select formControlName="destinationLocationId">
              @for (location of data.locations; track location.id) {
                <mat-option [value]="location.id" [disabled]="!location.isActive">{{
                  location.name
                }}</mat-option>
              }
            </mat-select>
            @if (form.controls.destinationLocationId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@orders.field.notes">Notes</mat-label>
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
          <span i18n="@@common.create">Create</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDialogComponent {
  readonly data = inject<PurchaseOrderDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<PurchaseOrderDialogComponent, PurchaseOrder>>(MatDialogRef);
  private readonly api = inject(PurchaseOrdersApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.formBuilder.group({
    supplierId: ['', [Validators.required]],
    destinationLocationId: ['', [Validators.required]],
    notes: [''],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .create(value.supplierId, value.destinationLocationId, blankToNull(value.notes))
      .subscribe({
        next: (order) => this.dialogRef.close(order),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            describeApiError(
              error,
              $localize`:@@orders.saveFailed:The purchase order could not be created.`,
            ),
          );
        },
      });
  }
}
