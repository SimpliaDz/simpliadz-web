import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull } from '../../../../shared/forms/form-values';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { Brand, BrandsApiService } from '../../brands/data-access/brands-api.service';
import {
  CategoriesApiService,
  CategoryNode,
} from '../../categories/data-access/categories-api.service';
import { ProductsApiService } from '../data-access/products-api.service';

interface Option {
  readonly id: string;
  readonly label: string;
}

function flattenCategories(nodes: readonly CategoryNode[], depth = 0): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children, depth + 1)]);
}

function categoryDepth(id: string, nodes: readonly CategoryNode[], depth = 0): number {
  for (const node of nodes) {
    if (node.id === id) {
      return depth;
    }
    const nested = categoryDepth(id, node.children, depth + 1);
    if (nested >= 0) {
      return nested;
    }
  }
  return -1;
}

@Component({
  selector: 'app-product-form-page',
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
    <app-page-header [title]="heading()" [backLink]="backLink()" />

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="card-surface">
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@products.field.name">Product name</mat-label>
            <input matInput formControlName="name" maxlength="200" cdkFocusInitial />
            @if (form.controls.name.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>


          <mat-form-field appearance="outline">
            <mat-label i18n="@@products.code">Code</mat-label>
            <input matInput formControlName="code" maxlength="50" />
            <mat-hint i18n="@@products.field.codeHint"
              >Optional. Stored in upper case and must be unique.</mat-hint
            >
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@products.field.brand">Brand</mat-label>
            <mat-select formControlName="brandId">
              <mat-option value="" i18n="@@common.none">None</mat-option>
              @for (option of brandOptions(); track option.id) {
                <mat-option [value]="option.id">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@products.field.category">Category</mat-label>
            <mat-select formControlName="categoryId">
              <mat-option value="" i18n="@@common.none">None</mat-option>
              @for (option of categoryOptions(); track option.id) {
                <mat-option [value]="option.id">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@products.field.description">Description</mat-label>
            <textarea matInput formControlName="description" rows="4" maxlength="2000"></textarea>
          </mat-form-field>
        </div>

        @if (formError(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }

        <div class="form-actions">
          <a mat-button [routerLink]="cancelPath()" i18n="@@common.cancel">Cancel</a>
          <button mat-flat-button type="submit" [disabled]="saving()">
            <span i18n="@@common.save">Save</span>
          </button>
        </div>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormPage {
  private readonly api = inject(ProductsApiService);
  private readonly brandsApi = inject(BrandsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  private readonly productId = this.route.snapshot.paramMap.get('id');
  readonly errorTitle = $localize`:@@products.form.loadFailed:We could not load the product form`;

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    code: ['', [Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(2000)]],
    brandId: [''],
    categoryId: [''],
  });

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly brandOptions = signal<Option[]>([]);
  readonly categoryOptions = signal<Option[]>([]);

  readonly heading = signal(
    this.productId
      ? $localize`:@@products.form.editHeading:Edit product`
      : $localize`:@@products.form.createHeading:New product`,
  );

  readonly backLink = signal({
    label: $localize`:@@products.backToList:All products`,
    path: '/app/catalogue/products',
  });

  cancelPath(): string {
    return this.productId ? `/app/catalogue/products/${this.productId}` : '/app/catalogue/products';
  }

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      brands: this.brandsApi.list(),
      categories: this.categoriesApi.tree(),
      product: this.productId ? this.api.get(this.productId) : of(null),
    }).subscribe({
      next: ({ brands, categories, product }) => {
        this.brandOptions.set(this.brandChoices(brands, product?.brandId ?? null));
        this.categoryOptions.set(this.categoryChoices(categories, product?.categoryId ?? null));
        if (product) {
          this.form.reset({
            name: product.name,
            code: product.code ?? '',
            description: product.description ?? '',
            brandId: product.brandId ?? '',
            categoryId: product.categoryId ?? '',
          });
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@products.form.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      code: blankToNull(value.code),
      description: blankToNull(value.description),
      brandId: blankToNull(value.brandId),
      categoryId: blankToNull(value.categoryId),
    };

    this.saving.set(true);
    this.formError.set(null);

    if (this.productId) {
      this.api.update(this.productId, request).subscribe({
        next: () =>
          this.finish(this.productId as string, $localize`:@@products.saved:Product saved.`),
        error: (error: unknown) => this.fail(error),
      });
    } else {
      this.api.create(request).subscribe({
        next: ({ id }) => this.finish(id, $localize`:@@products.created:Product created.`),
        error: (error: unknown) => this.fail(error),
      });
    }
  }

  private finish(id: string, message: string): void {
    this.saving.set(false);
    this.snackBar.open(message, undefined, { duration: 3000 });
    void this.router.navigate(['/app/catalogue/products', id]);
  }

  private fail(error: unknown): void {
    this.saving.set(false);
    this.formError.set(
      describeApiError(error, $localize`:@@products.saveFailed:We could not save the product.`),
    );
  }

  /** Active brands, plus the product's current brand even when it has been deactivated. */
  private brandChoices(brands: Brand[], currentId: string | null): Option[] {
    return brands
      .filter((brand) => brand.isActive || brand.id === currentId)
      .map((brand) => ({
        id: brand.id,
        label: brand.isActive ? brand.name : `${brand.name} ${inactiveSuffix}`,
      }));
  }

  private categoryChoices(tree: CategoryNode[], currentId: string | null): Option[] {
    return flattenCategories(tree)
      .filter((node) => node.isActive || node.id === currentId)
      .map((node) => {
        const depth = Math.max(0, categoryDepth(node.id, tree));
        return {
          id: node.id,
          label: `${'— '.repeat(depth)}${node.isActive ? node.name : `${node.name} ${inactiveSuffix}`}`,
        };
      });
  }
}

const inactiveSuffix = $localize`:@@common.inactiveSuffix:(inactive)`;
