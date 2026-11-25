import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { Location } from '../../locations/data-access/locations-api.service';
import { TransfersApiService } from '../data-access/transfers-api.service';

export interface TransferDialogData {
  readonly locations: Location[];
}

@Component({
  selector: 'app-transfer-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@transfers.dialog.title">New transfer</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="form-hint" i18n="@@transfers.dialog.hint">
          A transfer starts as a draft. Add lines, then complete it to move the stock.
        </p>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@transfers.source">From</mat-label>
            <mat-select formControlName="sourceLocationId">
              @for (location of data.locations; track location.id) {
                <mat-option [value]="location.id" [disabled]="!location.isActive">{{
                  location.name + (location.isActive ? '' : ' — Inactive')
                }}</mat-option>
              }
            </mat-select>
            @if (form.controls.sourceLocationId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@transfers.destination">To</mat-label>
            <mat-select formControlName="destinationLocationId">
              @for (location of data.locations; track location.id) {
                <mat-option [value]="location.id" [disabled]="!location.isActive || location.id === form.controls.sourceLocationId.value">{{
                  location.name + (!location.isActive ? ' — Inactive' : location.id === form.controls.sourceLocationId.value ? ' — Source location' : '')
                }}</mat-option>
              }
            </mat-select>
            @if (form.controls.destinationLocationId.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
        </div>
        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Cancel</button>
        @if (form.controls.sourceLocationId.value && form.controls.sourceLocationId.value === form.controls.destinationLocationId.value) {
          <p class="form-error" role="alert">Choose two different locations.</p>
        }
        <button mat-flat-button type="submit" [disabled]="saving() || form.controls.sourceLocationId.value === form.controls.destinationLocationId.value">
          <span i18n="@@common.create">Create</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferDialogComponent {
  readonly data = inject<TransferDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TransferDialogComponent, string>>(MatDialogRef);
  private readonly api = inject(TransfersApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    sourceLocationId: ['', [Validators.required]],
    destinationLocationId: ['', [Validators.required]],
  });

  save(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (value.sourceLocationId === value.destinationLocationId) {
      this.error.set($localize`:@@transfers.sameLocation:Choose two different locations.`);
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api.create(value.sourceLocationId, value.destinationLocationId).subscribe({
      next: (transfer) => this.dialogRef.close(transfer.id),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@transfers.saveFailed:The transfer could not be created.`,
          ),
        );
      },
    });
  }
}
