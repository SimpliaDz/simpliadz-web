import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull } from '../../../../shared/forms/form-values';
import { CategoriesApiService, CategoryNode } from '../data-access/categories-api.service';
import { Attribute, AttributesApiService } from '../../attributes/data-access/attributes-api.service';

export interface CategoryDialogData {
  readonly category: CategoryNode | null;
  /** Every category the new parent may be chosen from (the category itself and its descendants excluded). */
  readonly parentOptions: readonly ParentOption[];
}

export interface ParentOption {
  readonly id: string;
  readonly label: string;
}

@Component({
  selector: 'app-category-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.category ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@categories.field.name">Category name</mat-label>
            <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
            @if (form.controls.name.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@categories.field.attributes">Variant attributes</mat-label>
            <mat-select formControlName="attributeIds" multiple>
              @for (attribute of attributes(); track attribute.id) {
                <mat-option [value]="attribute.id">{{ attribute.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@categories.field.requiredAttributes">Required variant attributes</mat-label>
            <mat-select formControlName="requiredAttributeIds" multiple>
              @for (attribute of selectedAttributes(); track attribute.id) {
                <mat-option [value]="attribute.id">{{ attribute.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@categories.field.parent">Parent category</mat-label>
            <mat-select formControlName="parentCategoryId">
              <mat-option value="" i18n="@@categories.parent.root">Top level</mat-option>
              @for (option of data.parentOptions; track option.id) {
                <mat-option [value]="option.id">{{ option.label }}</mat-option>
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
          <span i18n="@@common.save">Save</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryDialogComponent {
  readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CategoryDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(CategoriesApiService);
  private readonly attributesApi = inject(AttributesApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@categories.dialog.create:New category`;
  readonly editTitle = $localize`:@@categories.dialog.edit:Edit category`;

  readonly form = this.formBuilder.group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    parentCategoryId: [this.data.category?.parentCategoryId ?? ''],
    attributeIds: this.formBuilder.control<string[]>(this.data.category?.attributeIds ?? []),
    requiredAttributeIds: this.formBuilder.control<string[]>(this.data.category?.requiredAttributeIds ?? []),
  });
  readonly attributes = signal<Attribute[]>([]);
  selectedAttributes(): Attribute[] {
    const ids = new Set(this.form.controls.attributeIds.value);
    return this.attributes().filter((attribute) => ids.has(attribute.id));
  }
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.attributesApi.list().subscribe({ next: (attributes) => this.attributes.set(attributes) });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      parentCategoryId: blankToNull(value.parentCategoryId),
      attributeIds: value.attributeIds,
      requiredAttributeIds: value.requiredAttributeIds,
    };
    const call = this.data.category
      ? this.api.update(this.data.category.id, request)
      : this.api.create(request);

    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          describeApiError(
            error,
            $localize`:@@categories.saveFailed:We could not save the category.`,
          ),
        );
      },
    });
  }
}
