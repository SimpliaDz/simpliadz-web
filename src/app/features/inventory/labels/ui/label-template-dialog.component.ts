import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { describeApiError } from '../../../../core/api/api-error-message';
import { numberOrNull } from '../../../../shared/forms/form-values';
import {
  LabelTemplate,
  LabelTemplateRequest,
  LabelsApiService,
} from '../data-access/labels-api.service';

export interface LabelTemplateDialogData {
  readonly template: LabelTemplate | null;
}

/** Ranges the backend accepts (millimetres). The label plus two margins must fit the page. */
const ranges = {
  pageWidthMm: [50, 420],
  pageHeightMm: [50, 594],
  labelWidthMm: [40, 200],
  labelHeightMm: [25, 200],
  marginMm: [0, 50],
  gapMm: [0, 50],
} as const;

@Component({
  selector: 'app-label-template-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.template ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@labels.field.name">Template name</mat-label>
            <input matInput formControlName="name" maxlength="100" cdkFocusInitial />
            @if (form.controls.name.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@labels.field.pageWidth">Page width (mm)</mat-label>
            <input matInput type="number" step="0.01" formControlName="pageWidthMm" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@labels.field.pageHeight">Page height (mm)</mat-label>
            <input matInput type="number" step="0.01" formControlName="pageHeightMm" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@labels.field.labelWidth">Label width (mm)</mat-label>
            <input matInput type="number" step="0.01" formControlName="labelWidthMm" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@labels.field.labelHeight">Label height (mm)</mat-label>
            <input matInput type="number" step="0.01" formControlName="labelHeightMm" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@labels.field.margin">Page margin (mm)</mat-label>
            <input matInput type="number" step="0.01" formControlName="marginMm" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@labels.field.gap">Gap between labels (mm)</mat-label>
            <input matInput type="number" step="0.01" formControlName="gapMm" />
          </mat-form-field>
          <div class="full-row toggles">
            <mat-slide-toggle formControlName="showName" i18n="@@labels.field.showName"
              >Show product name</mat-slide-toggle
            >
            <mat-slide-toggle formControlName="showSku" i18n="@@labels.field.showSku"
              >Show SKU</mat-slide-toggle
            >
          </div>
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
  styles: `
    .toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelTemplateDialogComponent {
  readonly data = inject<LabelTemplateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<LabelTemplateDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(LabelsApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@labels.dialog.create:New label template`;
  readonly editTitle = $localize`:@@labels.dialog.edit:Edit label template`;

  readonly form = this.formBuilder.group({
    name: [this.data.template?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    pageWidthMm: [this.data.template?.pageWidthMm ?? 210, [Validators.required]],
    pageHeightMm: [this.data.template?.pageHeightMm ?? 297, [Validators.required]],
    labelWidthMm: [this.data.template?.labelWidthMm ?? 90, [Validators.required]],
    labelHeightMm: [this.data.template?.labelHeightMm ?? 40, [Validators.required]],
    marginMm: [this.data.template?.marginMm ?? 5, [Validators.required]],
    gapMm: [this.data.template?.gapMm ?? 2, [Validators.required]],
    showName: [this.data.template?.showName ?? true],
    showSku: [this.data.template?.showSku ?? true],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  save(): void {
    const value = this.form.getRawValue();
    const numbers = {
      pageWidthMm: numberOrNull(value.pageWidthMm),
      pageHeightMm: numberOrNull(value.pageHeightMm),
      labelWidthMm: numberOrNull(value.labelWidthMm),
      labelHeightMm: numberOrNull(value.labelHeightMm),
      marginMm: numberOrNull(value.marginMm),
      gapMm: numberOrNull(value.gapMm),
    };
    if (this.form.invalid || Object.values(numbers).some((item) => item === null)) {
      this.form.markAllAsTouched();
      return;
    }
    const outOfRange = (Object.keys(ranges) as (keyof typeof ranges)[]).find((key) => {
      const [min, max] = ranges[key];
      const amount = numbers[key] as number;
      return amount < min || amount > max;
    });
    if (outOfRange) {
      this.error.set(
        $localize`:@@labels.rangeError:One of the sizes is outside the allowed range. Check the millimetre limits.`,
      );
      return;
    }

    const request: LabelTemplateRequest = {
      name: value.name.trim(),
      pageWidthMm: numbers.pageWidthMm as number,
      pageHeightMm: numbers.pageHeightMm as number,
      labelWidthMm: numbers.labelWidthMm as number,
      labelHeightMm: numbers.labelHeightMm as number,
      marginMm: numbers.marginMm as number,
      gapMm: numbers.gapMm as number,
      showName: value.showName,
      showSku: value.showSku,
    };
    const call = this.data.template
      ? this.api.updateTemplate(this.data.template.id, request)
      : this.api.createTemplate(request);

    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@labels.saveFailed:The label template could not be saved.`,
          ),
        );
      },
    });
  }
}
