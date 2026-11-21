import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AttributesApiService } from '../data-access/attributes-api.service';

@Component({
  selector: 'app-attribute-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@attributes.dialog.create">New attribute</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@attributes.field.name">Attribute name</mat-label>
          <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
          <mat-hint i18n="@@attributes.field.nameHint"
            >For example Color or Size. The name cannot be changed later.</mat-hint
          >
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
          <span i18n="@@common.create">Create</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttributeDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<AttributeDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(AttributesApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api.create(this.form.getRawValue().name.trim()).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@attributes.saveFailed:We could not create the attribute.`,
          ),
        );
      },
    });
  }
}
