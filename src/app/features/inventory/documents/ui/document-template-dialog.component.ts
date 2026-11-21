import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { describeApiError } from '../../../../core/api/api-error-message';
import {
  DocumentTemplate,
  DocumentTemplateRequest,
  DocumentType,
  DocumentsApiService,
  PaperSize,
  documentColumns,
  documentTypeFromNumber,
} from '../data-access/documents-api.service';

export interface DocumentTemplateDialogData {
  readonly template: DocumentTemplate | null;
}

@Component({
  selector: 'app-document-template-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.template ? editTitle : createTitle }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@documents.field.name">Template name</mat-label>
            <input matInput formControlName="name" maxlength="100" cdkFocusInitial />
            @if (form.controls.name.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@documents.field.type">Document type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="StockList" i18n="@@documents.type.stockList"
                >Stock list</mat-option
              >
              <mat-option value="CountSheet" i18n="@@documents.type.countSheet"
                >Count sheet</mat-option
              >
              <mat-option value="CountDifferences" i18n="@@documents.type.differences"
                >Count differences</mat-option
              >
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@documents.field.title">Title</mat-label>
            <input matInput formControlName="title" maxlength="150" />
            @if (form.controls.title.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@documents.field.columns">Columns</mat-label>
            <mat-select formControlName="columns" multiple>
              @for (column of columnOptions(); track column) {
                <mat-option [value]="column">{{ column }}</mat-option>
              }
            </mat-select>
            @if (form.controls.columns.hasError('required')) {
              <mat-error i18n="@@documents.columnsRequired">Choose at least one column.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@documents.field.paper">Paper size</mat-label>
            <mat-select formControlName="paperSize">
              <mat-option value="A4">A4</mat-option>
              <mat-option value="A3">A3</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-slide-toggle formControlName="landscape" i18n="@@documents.field.landscape"
            >Landscape</mat-slide-toggle
          >
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@documents.field.footer">Footer text</mat-label>
            <input matInput formControlName="footerText" maxlength="500" />
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
export class DocumentTemplateDialogComponent {
  readonly data = inject<DocumentTemplateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<DocumentTemplateDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(DocumentsApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly createTitle = $localize`:@@documents.dialog.create:New document template`;
  readonly editTitle = $localize`:@@documents.dialog.edit:Edit document template`;

  readonly initialType: DocumentType = this.data.template
    ? (documentTypeFromNumber[this.data.template.type] ?? 'StockList')
    : 'StockList';

  readonly form = this.formBuilder.group({
    name: [this.data.template?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    type: this.formBuilder.control<DocumentType>(this.initialType),
    title: [this.data.template?.title ?? '', [Validators.required, Validators.maxLength(150)]],
    columns: this.formBuilder.control<string[]>(
      this.data.template
        ? this.data.template.columns.split(',').map((column) => column.trim())
        : [...documentColumns[this.initialType]],
      [Validators.required],
    ),
    paperSize: this.formBuilder.control<PaperSize>(
      (this.data.template?.paperSize as PaperSize) ?? 'A4',
    ),
    landscape: [this.data.template?.landscape ?? false],
    footerText: [this.data.template?.footerText ?? '', [Validators.maxLength(500)]],
  });

  readonly typeValue = signal<DocumentType>(this.initialType);
  readonly columnOptions = computed(() => documentColumns[this.typeValue()]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (this.data.template) {
      this.form.controls.type.disable();
    }
    this.form.controls.type.valueChanges.subscribe((type) => {
      this.typeValue.set(type);
      const allowed = documentColumns[type];
      this.form.controls.columns.setValue(
        this.form.controls.columns.value.filter((column) => allowed.includes(column)),
      );
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: DocumentTemplateRequest = {
      name: value.name.trim(),
      type: value.type,
      title: value.title.trim(),
      columns: value.columns,
      paperSize: value.paperSize,
      landscape: value.landscape,
      footerText: value.footerText.trim() || null,
    };
    const call = this.data.template
      ? this.api.updateTemplate(this.data.template.id, {
          name: request.name,
          title: request.title,
          columns: request.columns,
          paperSize: request.paperSize,
          landscape: request.landscape,
          footerText: request.footerText,
        })
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
            $localize`:@@documents.saveFailed:The document template could not be saved.`,
          ),
        );
      },
    });
  }
}
