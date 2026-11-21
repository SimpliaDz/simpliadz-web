import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { toApiError } from '../../../../core/api/api-error';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { VariantsApiService } from '../../variants/data-access/variants-api.service';
import { Product, ProductsApiService } from '../data-access/products-api.service';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-products-page',
  imports: [
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Products describe what you sell. Stock and prices belong to their variants."
      i18n-subtitle="@@products.subtitle"
    >
      <button
        *appHasPermission="'products.create'"
        mat-flat-button
        type="button"
        [routerLink]="'/app/catalogue/products/new'"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@products.create">New product</span>
      </button>
    </app-page-header>

    <form class="toolbar" (ngSubmit)="applyFilters()" role="search">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label i18n="@@products.search">Search products</mat-label>
        <input matInput name="search" [(ngModel)]="searchText" type="search" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@common.status">Status</mat-label>
        <mat-select name="status" [(ngModel)]="statusFilter">
          <mat-option value="all" i18n="@@common.all">All</mat-option>
          <mat-option value="active" i18n="@@common.active">Active</mat-option>
          <mat-option value="inactive" i18n="@@common.inactive">Inactive</mat-option>
        </mat-select>
      </mat-form-field>
      <button mat-stroked-button type="submit" i18n="@@common.apply">Apply</button>
    </form>

    <form class="toolbar" [formGroup]="lookupForm" (ngSubmit)="lookup()" role="search">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label i18n="@@products.lookup">Find a variant by SKU or barcode</mat-label>
        <input matInput formControlName="code" maxlength="64" />
      </mat-form-field>
      <button
        mat-stroked-button
        type="submit"
        [disabled]="lookupBusy()"
        i18n="@@products.lookup.action"
      >
        Find variant
      </button>
    </form>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (products().length === 0) {
      <app-state-panel icon="inventory_2" [title]="emptyTitle" [message]="emptyMessage">
        <button
          *appHasPermission="'products.create'"
          mat-flat-button
          type="button"
          [routerLink]="'/app/catalogue/products/new'"
          i18n="@@products.create"
        >
          New product
        </button>
      </app-state-panel>
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="products()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let product">
              <a [routerLink]="['/app/catalogue/products', product.id]">{{ product.name }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef i18n="@@products.code">Code</th>
            <td mat-cell *matCellDef="let product">{{ product.code ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="variants">
            <th mat-header-cell *matHeaderCellDef i18n="@@products.variantCount">Variants</th>
            <td mat-cell *matCellDef="let product">{{ product.variants.length }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let product">
              <app-status-chip
                [label]="product.isActive ? activeLabel : inactiveLabel"
                [tone]="product.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let product" class="actions-cell">
              <a mat-stroked-button [routerLink]="['/app/catalogue/products', product.id]">
                <span i18n="@@common.viewDetails">View</span>
              </a>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage {
  private readonly api = inject(ProductsApiService);
  private readonly variants = inject(VariantsApiService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly heading = $localize`:@@products.heading:Products`;
  readonly errorTitle = $localize`:@@products.loadFailed:We could not load products`;
  readonly emptyTitle = $localize`:@@products.empty.title:No products match`;
  readonly emptyMessage = $localize`:@@products.empty.message:Try another search, or add your first product.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;

  readonly columns = ['name', 'code', 'variants', 'status', 'actions'];
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly lookupBusy = signal(false);

  searchText = '';
  statusFilter: StatusFilter = 'all';
  private activeSearch: string | null = null;
  private activeStatus: StatusFilter = 'all';

  readonly lookupForm = this.formBuilder.group({ code: [''] });

  activeFilter(): boolean | null {
    return this.activeStatus === 'all' ? null : this.activeStatus === 'active';
  }

  constructor() {
    this.load();
  }

  applyFilters(): void {
    this.activeSearch = this.searchText.trim() || null;
    this.activeStatus = this.statusFilter;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list({ search: this.activeSearch, isActive: this.activeFilter() }).subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@products.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  lookup(): void {
    const code = this.lookupForm.getRawValue().code.trim();
    if (!code) {
      return;
    }

    this.lookupBusy.set(true);
    this.variants.findBySku(code).subscribe({
      next: (variant) => this.openVariant(variant.id),
      error: (skuError: unknown) => {
        if (toApiError(skuError).status !== 404) {
          this.lookupBusy.set(false);
          this.notify(
            describeApiError(skuError, $localize`:@@products.lookupFailed:The lookup failed.`),
          );
          return;
        }
        this.variants.findByBarcode(code).subscribe({
          next: (variant) => this.openVariant(variant.id),
          error: (barcodeError: unknown) => {
            this.lookupBusy.set(false);
            this.notify(
              toApiError(barcodeError).status === 404
                ? $localize`:@@products.lookupNotFound:No variant has that SKU or barcode.`
                : describeApiError(
                    barcodeError,
                    $localize`:@@products.lookupFailed:The lookup failed.`,
                  ),
            );
          },
        });
      },
    });
  }

  private openVariant(id: string): void {
    this.lookupBusy.set(false);
    void this.router.navigate(['/app/catalogue/variants', id]);
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 5000 });
  }
}
