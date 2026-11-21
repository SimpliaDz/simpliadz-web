import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { numberOrNull } from '../../../../shared/forms/form-values';
import { Location } from '../../locations/data-access/locations-api.service';
import { InventoryPolicy, StockApiService } from '../data-access/stock-api.service';
import { VariantOption } from '../data-access/variant-catalogue.service';

export interface PolicyDialogData {
  /** Set when editing an existing policy; the variant and location are then fixed. */
  readonly policy: InventoryPolicy | null;
  readonly variants: readonly VariantOption[];
  readonly locations: readonly Location[];
}

@Component({
  selector: 'app-policy-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@policies.dialog.title">Reorder policy</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          @if (data.policy === null) {
            <mat-form-field appearance="outline" class="full-row">
              <mat-label i18n="@@stock.field.variant">Product variant</mat-label>
              <mat-select formControlName="productVariantId">
                @for (variant of data.variants; track variant.id) {
                  <mat-option [value]="variant.id" [disabled]="!variant.isActive">{{
                    variant.label
                  }}</mat-option>
                }
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
              @if (form.controls.locationId.hasError('required')) {
                <mat-error i18n="@@validation.required">This field is required.</mat-error>
              }
            </mat-form-field>
          }

          <mat-form-field appearance="outline">
            <mat-label i18n="@@policies.reorderPoint">Reorder point</mat-label>
            <input
              matInput
              type="number"
              step="1"
              min="0"
              formControlName="reorderPoint"
              cdkFocusInitial
            />
            <mat-hint i18n="@@policies.reorderHint"
              >Reorder when on-hand stock falls below this.</mat-hint
            >
            @if (form.controls.reorderPoint.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            } @else if (form.controls.reorderPoint.hasError('min')) {
              <mat-error i18n="@@validation.nonNegative">Use zero or a positive number.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@policies.targetLevel">Target stock level</mat-label>
            <input matInput type="number" step="1" min="0" formControlName="targetStockLevel" />
            <mat-hint i18n="@@policies.targetHint"
              >Optional. Must be at least the reorder point.</mat-hint
            >
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
export class PolicyDialogComponent {
  readonly data = inject<PolicyDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PolicyDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(StockApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    productVariantId: [this.data.policy?.productVariantId ?? '', [Validators.required]],
    locationId: [this.data.policy?.locationId ?? '', [Validators.required]],
    reorderPoint: [this.data.policy?.reorderPoint ?? 0, [Validators.required, Validators.min(0)]],
    targetStockLevel: [this.data.policy?.targetStockLevel?.toString() ?? ''],
  });

  save(): void {
    const value = this.form.getRawValue();
    const reorderPoint = numberOrNull(value.reorderPoint);
    const target = numberOrNull(value.targetStockLevel);

    if (this.data.policy === null && (!value.productVariantId || !value.locationId)) {
      this.form.markAllAsTouched();
      return;
    }
    if (reorderPoint === null || reorderPoint < 0 || !Number.isInteger(reorderPoint)) {
      this.form.controls.reorderPoint.setErrors({ min: true });
      return;
    }
    if (target !== null && (target < reorderPoint || !Number.isInteger(target))) {
      this.error.set(
        $localize`:@@policies.targetInvalid:The target must be a whole number at least equal to the reorder point.`,
      );
      return;
    }

    const variantId = this.data.policy?.productVariantId ?? value.productVariantId;
    const locationId = this.data.policy?.locationId ?? value.locationId;

    this.saving.set(true);
    this.error.set(null);
    this.api
      .savePolicy(variantId, locationId, { reorderPoint, targetStockLevel: target })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            describeApiError(
              error,
              $localize`:@@policies.saveFailed:The policy could not be saved.`,
            ),
          );
        },
      });
  }
}
