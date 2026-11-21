import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { PriceListsApiService, PriceListType } from '../data-access/price-lists-api.service';

@Component({
  selector: 'app-price-list-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@priceLists.dialog.create">New price list</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@priceLists.name">Price list</mat-label>
            <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
            @if (form.controls.name.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@priceLists.currency">Currency code</mat-label>
            <input matInput formControlName="currencyCode" maxlength="3" />
            <mat-hint i18n="@@priceLists.currencyHint">Three letters, for example DZD.</mat-hint>
            @if (form.controls.currencyCode.hasError('pattern')) {
              <mat-error i18n="@@validation.currency">Use three letters.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@priceLists.type">Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="Retail" i18n="@@priceLists.type.retail">Retail</mat-option>
              <mat-option value="Wholesale" i18n="@@priceLists.type.wholesale"
                >Wholesale</mat-option
              >
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
          <span i18n="@@common.create">Create</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<PriceListDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(PriceListsApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    currencyCode: ['DZD', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    type: this.formBuilder.control<PriceListType>('Retail', [Validators.required]),
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

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
        name: value.name.trim(),
        currencyCode: value.currencyCode.toUpperCase(),
        type: value.type,
      })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            describeApiError(
              error,
              $localize`:@@priceLists.saveFailed:We could not create the price list.`,
            ),
          );
        },
      });
  }
}
