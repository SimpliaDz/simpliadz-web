import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull, numberOrNull } from '../../../../shared/forms/form-values';
import { Location } from '../../../inventory/locations/data-access/locations-api.service';
import { matchesVariant, VariantOption } from '../data-access/variant-catalogue.service';
import { StockApiService, StockBalance } from '../data-access/stock-api.service';

export type StockMovementMode = 'receipt' | 'opening' | 'adjustment';

export interface StockMovementDialogData {
  readonly mode: StockMovementMode;
  readonly variants: readonly VariantOption[];
  readonly locations: readonly Location[];
  readonly variantId: string | null;
  readonly locationId: string | null;
  readonly balances?: readonly StockBalance[];
}

@Component({
  selector: 'app-stock-movement-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label>Search products and variants</mat-label>
            <input matInput #variantQuery (input)="variantSearch.set(variantQuery.value)"
              placeholder="Name, attributes, SKU or barcode" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@stock.field.variant">Product variant</mat-label>
            <mat-select formControlName="productVariantId">
              @for (variant of matchingVariants(); track variant.id) {
                <mat-option [value]="variant.id" [disabled]="!variant.isActive">{{
                  variant.label
                }} @if (data.balances && form.controls.locationId.value) {
                  · {{ stockAtLocation(variant.id) }} on hand
                }</mat-option>
              } @empty { <mat-option disabled>No matching variants</mat-option> }
            </mat-select>
            @if (form.controls.productVariantId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@stock.field.location">Location</mat-label>
            <mat-select formControlName="locationId">
              @for (location of data.locations; track location.id) {
                <mat-option [value]="location.id" [disabled]="!location.isActive">{{
                  location.name
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (isAdjustment()) {
            <div class="full-row">
              <mat-radio-group
                formControlName="method"
                class="radio-row"
                aria-label="Adjustment method"
                i18n-aria-label="@@stock.adjust.method"
              >
                <mat-radio-button value="set" i18n="@@stock.adjust.set"
                  >Set the counted quantity</mat-radio-button
                >
                <mat-radio-button value="delta" i18n="@@stock.adjust.delta"
                  >Add or remove a quantity</mat-radio-button
                >
              </mat-radio-group>
            </div>
          }

          <mat-form-field appearance="outline">
            <mat-label>{{ quantityLabel() }}</mat-label>
            <input matInput type="number" step="1" formControlName="quantity" />
            <mat-hint>{{ quantityHint() }}</mat-hint>
            @if (form.controls.quantity.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            } @else if (form.controls.quantity.hasError('whole')) {
              <mat-error i18n="@@validation.wholeNumber">Use a whole number.</mat-error>
            } @else if (form.controls.quantity.hasError('min')) {
              <mat-error i18n="@@validation.stockMin">The quantity is too small.</mat-error>
            } @else if (form.controls.quantity.hasError('zero')) {
              <mat-error i18n="@@stock.adjust.zero">Enter a quantity other than zero.</mat-error>
            }
          </mat-form-field>

          @if (data.mode === 'receipt') {
            <mat-form-field appearance="outline">
              <mat-label i18n="@@stock.field.reference">Reference</mat-label>
              <input matInput formControlName="reference" maxlength="50" />
              <mat-hint i18n="@@stock.field.referenceHint"
                >Supplier invoice or delivery note.</mat-hint
              >
            </mat-form-field>
          }

          <mat-form-field appearance="outline" class="full-row">
            <mat-label>{{ reasonLabel() }}</mat-label>
            <input matInput formControlName="reason" maxlength="500" />
            @if (form.controls.reason.hasError('required')) {
              <mat-error i18n="@@stock.adjust.reasonRequired"
                >A reason is required for an adjustment.</mat-error
              >
            }
          </mat-form-field>
        </div>

        @if (isAdjustment()) {
          <p class="form-hint" i18n="@@stock.adjust.auditNotice">
            Adjustments are recorded in the audit trail.
          </p>
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
    .radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockMovementDialogComponent {
  readonly variantSearch = signal('');
  readonly matchingVariants = computed(() =>
    this.data.variants.filter(variant => matchesVariant(variant, this.variantSearch())));

  stockAtLocation(variantId: string): number {
    return this.data.balances?.find(balance => balance.productVariantId === variantId
      && balance.locationId === this.form.controls.locationId.value)?.quantityOnHand ?? 0;
  }
  readonly data = inject<StockMovementDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<StockMovementDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(StockApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly isAdjustment = computed(() => this.data.mode === 'adjustment');

  readonly title = signal(
    this.data.mode === 'receipt'
      ? $localize`:@@stock.receipt.title:Receive stock`
      : this.data.mode === 'opening'
        ? $localize`:@@stock.opening.title:Record opening stock`
        : $localize`:@@stock.adjust.title:Adjust stock`,
  );

  readonly form = this.formBuilder.group({
    productVariantId: [this.data.variantId ?? '', [Validators.required]],
    locationId: [this.data.locationId ?? '', [Validators.required]],
    method: this.formBuilder.control<'set' | 'delta'>('delta'),
    quantity: this.formBuilder.control<number | null>(null, [Validators.required]),
    reference: [''],
    reason: [''],
  });

  readonly quantityLabel = signal(
    this.data.mode === 'adjustment'
      ? $localize`:@@stock.field.quantityChange:Quantity`
      : $localize`:@@stock.field.quantity:Quantity`,
  );

  readonly quantityHint = signal(
    this.data.mode === 'adjustment'
      ? $localize`:@@stock.adjust.hint:Use a negative number to remove stock.`
      : '',
  );

  readonly reasonLabel = signal(
    this.data.mode === 'adjustment'
      ? $localize`:@@stock.field.reasonRequired:Reason (required)`
      : $localize`:@@stock.field.reason:Reason (optional)`,
  );

  save(): void {
    const value = this.form.getRawValue();
    const quantity = numberOrNull(value.quantity);
    if (quantity === null || !Number.isInteger(quantity)) {
      this.form.controls.quantity.setErrors({ whole: true });
      this.form.markAllAsTouched();
      return;
    }

    if (this.data.mode === 'receipt' && quantity <= 0) {
      this.form.controls.quantity.setErrors({ min: true });
      return;
    }
    if (this.data.mode === 'opening' && quantity < 0) {
      this.form.controls.quantity.setErrors({ min: true });
      return;
    }
    if (this.isAdjustment() && value.method === 'delta' && quantity === 0) {
      this.form.controls.quantity.setErrors({ zero: true });
      return;
    }
    if (this.isAdjustment() && value.method === 'set' && quantity < 0) {
      this.form.controls.quantity.setErrors({ min: true });
      return;
    }
    if (this.isAdjustment() && value.reason.trim().length === 0) {
      this.form.controls.reason.setErrors({ required: true });
      return;
    }
    if (this.form.controls.productVariantId.invalid || this.form.controls.locationId.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const base = {
      productVariantId: value.productVariantId,
      locationId: value.locationId,
    };
    const reason = blankToNull(value.reason);

    const request =
      this.data.mode === 'receipt'
        ? this.api.receive({ ...base, quantity, reference: blankToNull(value.reference), reason })
        : this.data.mode === 'opening'
          ? this.api.opening({ ...base, quantity, reason })
          : this.api.adjust(
              value.method === 'set'
                ? { ...base, quantityOnHand: quantity, reason: value.reason.trim() }
                : { ...base, quantityDelta: quantity, reason: value.reason.trim() },
            );

    request.subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@stock.saveFailed:The stock change could not be saved.`,
          ),
        );
      },
    });
  }
}
