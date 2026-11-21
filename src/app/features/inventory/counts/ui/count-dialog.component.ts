import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { Location } from '../../locations/data-access/locations-api.service';
import { CountsApiService } from '../data-access/counts-api.service';

export interface CountDialogData {
  readonly locations: Location[];
}

@Component({
  selector: 'app-count-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@counts.dialog.title">Start a stock count</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="form-hint" i18n="@@counts.dialog.hint">
          The count records today's balances at the location as expected quantities. Enter what you
          find, then complete the count.
        </p>
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
        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          <span i18n="@@counts.start">Start count</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountDialogComponent {
  readonly data = inject<CountDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CountDialogComponent, string>>(MatDialogRef);
  private readonly api = inject(CountsApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.formBuilder.group({
    locationId: ['', [Validators.required]],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.start(this.form.getRawValue().locationId).subscribe({
      next: (count) => this.dialogRef.close(count.id),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(error, $localize`:@@counts.saveFailed:The count could not be started.`),
        );
      },
    });
  }
}
