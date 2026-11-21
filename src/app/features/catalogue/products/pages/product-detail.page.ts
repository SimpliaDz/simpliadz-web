import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { BrandsApiService } from '../../brands/data-access/brands-api.service';
import {
  CategoriesApiService,
  CategoryNode,
} from '../../categories/data-access/categories-api.service';
import { Product, ProductsApiService } from '../data-access/products-api.service';

function findCategoryName(nodes: readonly CategoryNode[], id: string): string | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node.name;
    }
    const nested = findCategoryName(node.children, id);
    if (nested) {
      return nested;
    }
  }
  return null;
}

@Component({
  selector: 'app-product-detail-page',
  imports: [
    DecimalPipe,
    HasPermissionDirective,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (product(); as current) {
      <app-page-header [title]="current.name" [backLink]="backLink">
        <button
          *appHasPermission="'products.edit'"
          mat-stroked-button
          type="button"
          [routerLink]="['/app/catalogue/products', current.id, 'edit']"
        >
          <mat-icon aria-hidden="true">edit</mat-icon>
          <span i18n="@@common.edit">Edit</span>
        </button>
        @if (current.isActive) {
          <button
            *appHasPermission="'products.edit'"
            mat-stroked-button
            type="button"
            (click)="deactivate(current)"
          >
            <mat-icon aria-hidden="true">block</mat-icon>
            <span i18n="@@common.deactivate">Deactivate</span>
          </button>
        }
      </app-page-header>

      <div class="card-grid">
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title i18n="@@products.details">Details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <dl class="detail-list">
              <dt i18n="@@common.status">Status</dt>
              <dd>
                <app-status-chip
                  [label]="current.isActive ? activeLabel : inactiveLabel"
                  [tone]="current.isActive ? 'success' : 'neutral'"
                />
              </dd>
              <dt i18n="@@products.code">Code</dt>
              <dd>{{ current.code ?? '—' }}</dd>
              <dt i18n="@@products.field.brand">Brand</dt>
              <dd>{{ brandName() ?? '—' }}</dd>
              <dt i18n="@@products.field.category">Category</dt>
              <dd>{{ categoryName() ?? '—' }}</dd>
            </dl>
            @if (current.description) {
              <p class="muted description">{{ current.description }}</p>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <div class="section-header">
        <h2 class="section-title" i18n="@@products.variants">Variants</h2>
        <button
          *appHasPermission="'variants.create'"
          mat-flat-button
          type="button"
          [routerLink]="['/app/catalogue/products', current.id, 'variants', 'new']"
        >
          <mat-icon aria-hidden="true">add</mat-icon>
          <span i18n="@@products.variants.create">Add variant</span>
        </button>
      </div>

      @if (current.variants.length === 0) {
        <app-state-panel
          icon="deployed_code"
          [title]="noVariantsTitle"
          [message]="noVariantsMessage"
        />
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="current.variants" class="data-table">
            <ng-container matColumnDef="sku">
              <th mat-header-cell *matHeaderCellDef i18n="@@variants.sku">SKU</th>
              <td mat-cell *matCellDef="let variant">
                <a [routerLink]="['/app/catalogue/variants', variant.id]">{{ variant.sku }}</a>
              </td>
            </ng-container>
            <ng-container matColumnDef="barcode">
              <th mat-header-cell *matHeaderCellDef i18n="@@variants.barcode">Barcode</th>
              <td mat-cell *matCellDef="let variant">{{ variant.barcode ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="retail">
              <th mat-header-cell *matHeaderCellDef i18n="@@variants.retailPrice">Retail price</th>
              <td mat-cell *matCellDef="let variant">
                {{ variant.retailPrice | number: '1.2-4' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
              <td mat-cell *matCellDef="let variant">
                <app-status-chip
                  [label]="variant.isActive ? activeLabel : inactiveLabel"
                  [tone]="variant.isActive ? 'success' : 'neutral'"
                />
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="variantColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: variantColumns"></tr>
          </table>
        </div>
      }
    }
  `,
  styles: `
    .section-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .description {
      margin-block-start: 1rem;
      white-space: pre-line;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailPage {
  private readonly api = inject(ProductsApiService);
  private readonly brandsApi = inject(BrandsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly productId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly errorTitle = $localize`:@@products.detail.loadFailed:We could not load this product`;
  readonly noVariantsTitle = $localize`:@@products.noVariants.title:No variants yet`;
  readonly noVariantsMessage = $localize`:@@products.noVariants.message:A variant is the sellable and stockable form of a product, for example a size and color. Add the first one.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly backLink = {
    label: $localize`:@@products.backToList:All products`,
    path: '/app/catalogue/products',
  };
  readonly variantColumns = ['sku', 'barcode', 'retail', 'status'];

  readonly product = signal<Product | null>(null);
  readonly brandName = signal<string | null>(null);
  readonly categoryName = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      product: this.api.get(this.productId),
      brands: this.brandsApi.list(),
      categories: this.categoriesApi.tree(),
    }).subscribe({
      next: ({ product, brands, categories }) => {
        this.product.set(product);
        this.brandName.set(brands.find((brand) => brand.id === product.brandId)?.name ?? null);
        this.categoryName.set(
          product.categoryId ? findCategoryName(categories, product.categoryId) : null,
        );
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@products.detail.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  deactivate(product: Product): void {
    this.confirm
      .confirm({
        title: $localize`:@@products.deactivate.title:Deactivate product?`,
        message: $localize`:@@products.deactivate.message:Its variants stay as they are, but the product is hidden from new work. Products cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivate(product.id).subscribe({
          next: () => {
            this.snackBar.open($localize`:@@products.deactivated:Product deactivated.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@products.deactivateFailed:The product could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }
}
