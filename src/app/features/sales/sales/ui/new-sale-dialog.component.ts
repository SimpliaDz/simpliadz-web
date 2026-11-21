import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull } from '../../../../shared/forms/form-values';
import { Location } from '../../../inventory/locations/data-access/locations-api.service';
import { PriceList } from '../../../inventory/price-lists/data-access/price-lists-api.service';
import { Customer } from '../../customers/data-access/customers-api.service';
import { Sale, SalesApiService } from '../data-access/sales-api.service';

export interface NewSaleDialogData {
  readonly locations: readonly Location[];
  readonly priceLists: readonly PriceList[];
  readonly customers: readonly Customer[];
}

@Component({
  selector: 'app-new-sale-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@sales.dialog.title">New sale</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@stock.field.location">Location</mat-label>
            <mat-select formControlName="locationId">
              @for (location of data.locations; track location.id) {
                <mat-option [value]="location.id" [disabled]="!location.isActive">{{
                  location.name
                }}</mat-option>
              }
            </mat-select>
            @if (form.controls.locationId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@sales.field.priceList">Price list</mat-label>
            <mat-select formControlName="priceListId">
              @for (list of data.priceLists; track list.id) {
                <mat-option [value]="list.id" [disabled]="!list.isActive"
                  >{{ list.name }} · {{ list.currencyCode }}</mat-option
                >
              }
            </mat-select>
            @if (form.controls.priceListId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@sales.field.customer">Customer (optional)</mat-label>
            <mat-select formControlName="customerId">
              <mat-option value="" i18n="@@common.none">None</mat-option>
              @for (customer of data.customers; track customer.id) {
                <mat-option [value]="customer.id">{{ customer.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          <span i18n="@@sales.start">Start sale</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewSaleDialogComponent {
  readonly data = inject<NewSaleDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<NewSaleDialogComponent, Sale>>(MatDialogRef);
  private readonly api = inject(SalesApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.formBuilder.group({
    locationId: ['', [Validators.required]],
    priceListId: [
      this.data.priceLists.find((list) => list.isActive && list.type === 'Retail')?.id ?? '',
      [Validators.required],
    ],
    customerId: [''],
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
      .create({
        locationId: value.locationId,
        priceListId: value.priceListId,
        customerId: blankToNull(value.customerId),
      })
      .subscribe({
        next: (sale) => this.dialogRef.close(sale),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            describeApiError(
              error,
              $localize`:@@sales.createFailed:The sale could not be started.`,
            ),
          );
        },
      });
  }
}
