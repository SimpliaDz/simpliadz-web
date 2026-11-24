import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull, numberOrNull } from '../../../../shared/forms/form-values';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import {
  Attribute,
  AttributesApiService,
} from '../../attributes/data-access/attributes-api.service';
import { Product, ProductsApiService } from '../../products/data-access/products-api.service';
import { VariantsApiService } from '../data-access/variants-api.service';

@Component({
  selector: 'app-variant-create-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    StatePanelComponent,
  ],
  template: `
    <app-page-header [title]="heading" [backLink]="backLink()" [subtitle]="subtitle()" />

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (base(); as form) {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="form-surface">
        <h2 class="section-title" i18n="@@variants.section.identity">Identity and prices</h2>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@variants.sku">SKU</mat-label>
            <input matInput formControlName="sku" maxlength="64" cdkFocusInitial />
            @if (form.controls.sku.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@variants.barcode">Barcode</mat-label>
            <input matInput formControlName="barcode" maxlength="64" />
            <mat-hint i18n="@@variants.barcodeHint">Optional. You can generate one later.</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@variants.retailPrice">Retail price</mat-label>
            <input matInput type="number" min="0" step="0.0001" formControlName="retailPrice" />
            @if (form.controls.retailPrice.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            } @else if (form.controls.retailPrice.hasError('min')) {
              <mat-error i18n="@@validation.nonNegative">Use zero or a positive number.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@variants.wholesalePrice">Wholesale price</mat-label>
            <input matInput type="number" min="0" step="0.0001" formControlName="wholesalePrice" />
            <mat-hint i18n="@@variants.legacyPriceHint"
              >Legacy field. Selling uses price lists.</mat-hint
            >
          </mat-form-field>
        </div>

        <h2 class="section-title" i18n="@@variants.section.attributes">Attribute values</h2>
        <p class="form-hint" i18n="@@variants.attributesHint">
          Optional. Choose at most one value per configured attribute.
        </p>
        @if (selections(); as group) {
          <div class="form-grid" [formGroup]="group">
            @for (attribute of attributes(); track attribute.id) {
              <mat-form-field appearance="outline">
                <mat-label>{{ attribute.name }}</mat-label>
                <mat-select [formControlName]="attribute.id">
                  <mat-option value="" i18n="@@common.none">None</mat-option>
                  @for (value of attribute.values; track value.id) {
                    <mat-option [value]="value.id">{{ value.value }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
          </div>
        }

        @if (formError(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }

        <div class="form-actions">
          <a mat-button [routerLink]="['/app/catalogue/products', productId]" i18n="@@common.cancel"
            >Cancel</a
          >
          <button mat-flat-button type="submit" [disabled]="saving()">
            <span i18n="@@common.create">Create</span>
          </button>
        </div>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantCreatePage {
  private readonly productsApi = inject(ProductsApiService);
  private readonly attributesApi = inject(AttributesApiService);
  private readonly variantsApi = inject(VariantsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly productId = this.route.snapshot.paramMap.get('productId') ?? '';
  readonly heading = $localize`:@@variants.create.heading:New variant`;
  readonly errorTitle = $localize`:@@variants.create.loadFailed:We could not load the variant form`;

  readonly product = signal<Product | null>(null);
  readonly attributes = signal<Attribute[]>([]);
  readonly backLink = signal({
    label: $localize`:@@variants.create.backToProduct:Back to product`,
    path: `/app/catalogue/products/${this.productId}`,
  });
  readonly subtitle = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly base = signal<FormGroup<{
    sku: FormControl<string>;
    barcode: FormControl<string>;
    retailPrice: FormControl<number | null>;
    wholesalePrice: FormControl<number | null>;
  }> | null>(null);
  readonly selections = signal<FormGroup<Record<string, FormControl<string>>> | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      product: this.productsApi.get(this.productId),
      attributes: this.attributesApi.list(),
    }).subscribe({
      next: ({ product, attributes }) => {
        this.product.set(product);
        this.subtitle.set(product.name);
        this.attributes.set(attributes.filter((attribute) => product.attributeIds.includes(attribute.id)));
        this.base.set(
          this.formBuilder.group({
            sku: ['', [Validators.required, Validators.maxLength(64)]],
            barcode: ['', [Validators.maxLength(64)]],
            retailPrice: this.formBuilder.control<number | null>(null, [
              Validators.required,
              Validators.min(0),
            ]),
            wholesalePrice: this.formBuilder.control<number | null>(null, [Validators.min(0)]),
          }),
        );
        this.selections.set(
          this.formBuilder.group(
            Object.fromEntries(
              attributes.filter((attribute) => product.attributeIds.includes(attribute.id))
                .map((attribute) => [attribute.id, this.formBuilder.control('')]),
            ),
          ),
        );
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@variants.create.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  save(): void {
    const base = this.base();
    const selections = this.selections();
    if (!base || !selections) {
      return;
    }

    const chosen = Object.values(selections.getRawValue()).filter((id) => id.length > 0);
    if (base.invalid) {
      base.markAllAsTouched();
      return;
    }

    const value = base.getRawValue();
    this.saving.set(true);
    this.formError.set(null);

    this.variantsApi
      .create(this.productId, {
        sku: value.sku.trim(),
        barcode: blankToNull(value.barcode),
        retailPrice: numberOrNull(value.retailPrice) ?? 0,
        wholesalePrice: numberOrNull(value.wholesalePrice),
        attributeValueIds: chosen,
      })
      .subscribe({
        next: (variant) => {
          this.snackBar.open($localize`:@@variants.created:Variant created.`, undefined, {
            duration: 3000,
          });
          void this.router.navigate(['/app/catalogue/variants', variant.id]);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.formError.set(
            describeApiError(
              error,
              $localize`:@@variants.saveFailed:We could not create the variant.`,
            ),
          );
        },
      });
  }
}
