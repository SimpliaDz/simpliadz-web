import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { Location } from '../../../inventory/locations/data-access/locations-api.service';
import { CashApiService, CashRegister } from '../data-access/cash-api.service';

export interface RegisterDialogData {
  readonly register: CashRegister | null;
  readonly locations: readonly Location[];
}

@Component({
  selector: 'app-register-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.register ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
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
          <mat-form-field appearance="outline">
            <mat-label i18n="@@registers.field.code">Code</mat-label>
            <input matInput formControlName="code" maxlength="40" />
            @if (form.controls.code.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@registers.field.name">Name</mat-label>
            <input matInput formControlName="name" maxlength="100" />
            @if (form.controls.name.hasError('required')) {
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
        <button mat-flat-button type="submit" [disabled]="saving()">
          <span i18n="@@common.save">Save</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterDialogComponent {
  readonly data = inject<RegisterDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RegisterDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(CashApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@registers.dialog.create:New cash register`;
  readonly editTitle = $localize`:@@registers.dialog.edit:Edit cash register`;

  readonly form = this.formBuilder.group({
    locationId: [this.data.register?.locationId ?? '', [Validators.required]],
    code: [this.data.register?.code ?? '', [Validators.required, Validators.maxLength(40)]],
    name: [this.data.register?.name ?? '', [Validators.required, Validators.maxLength(100)]],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const call = this.data.register
      ? this.api.updateRegister(this.data.register.id, value.code.trim(), value.name.trim())
      : this.api.createRegister({
          locationId: value.locationId,
          code: value.code.trim(),
          name: value.name.trim(),
        });

    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@registers.saveFailed:The cash register could not be saved.`,
          ),
        );
      },
    });
  }
}
