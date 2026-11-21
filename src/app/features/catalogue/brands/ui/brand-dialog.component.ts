import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { describeApiError } from '../../../../core/api/api-error-message';
import { Brand, BrandsApiService } from '../data-access/brands-api.service';

export interface BrandDialogData {
  readonly brand: Brand | null;
}

@Component({
  selector: 'app-brand-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.brand ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@brands.field.name">Brand name</mat-label>
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
export class BrandDialogComponent {
  readonly data = inject<BrandDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<BrandDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(BrandsApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@brands.dialog.create:New brand`;
  readonly editTitle = $localize`:@@brands.dialog.edit:Edit brand`;

  readonly form = this.formBuilder.group({
    name: [this.data.brand?.name ?? '', [Validators.required, Validators.maxLength(150)]],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.getRawValue().name.trim();
    const request = this.data.brand
      ? this.api.update(this.data.brand.id, name)
      : this.api.create(name);

    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(error, $localize`:@@brands.saveFailed:We could not save the brand.`),
        );
      },
    });
  }
}
