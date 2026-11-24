import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { Observable } from 'rxjs';
import { describeApiError } from '../../../core/api/api-error-message';
import { PagerComponent } from '../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel/state-panel.component';
import {
  Location,
  LocationsApiService,
} from '../../inventory/locations/data-access/locations-api.service';
import {
  InventoryReport,
  LowStockReport,
  ProductPerformance,
  ReportsApiService,
  SalesSummary,
  VariantPerformance,
} from '../data-access/reports-api.service';

export type ReportKind = 'sales' | 'products' | 'inventory' | 'lowStock';

const pageSize = 50;

/** Local calendar day as yyyy-mm-dd (the API reports are date-only). */
function dayText(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-reports-page',
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    StatePanelComponent,
  ],
  template: `
    <app-page-header [title]="heading()" [subtitle]="subtitle()" />

    @switch (kind()) {
      @case ('sales') {
        <form class="toolbar" (ngSubmit)="runSales()" role="form">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.from">From</mat-label>
            <input matInput type="date" name="from" [(ngModel)]="fromDate" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.to">To</mat-label>
            <input matInput type="date" name="to" [(ngModel)]="toDate" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Location</mat-label>
            <mat-select name="salesLocation" [(ngModel)]="salesLocationId">
              <mat-option [value]="null">All locations</mat-option>
              @for (location of locations(); track location.id) {
                <mat-option [value]="location.id">{{ location.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="busy()" i18n="@@report.run">
            Run report
          </button>
        </form>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" class="loading-bar" />
        } @else if (error(); as message) {
          <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message" />
        } @else if (sales(); as s) {
          <div class="card-grid">
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@reports.revenue">Revenue</p>
                <p class="metric">{{ s.revenue | number: '1.2-2' }}</p>
              </mat-card-content></mat-card
            >
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@reports.cogs">Cost of goods sold</p>
                <p class="metric">{{ s.costOfGoodsSold | number: '1.2-2' }}</p>
              </mat-card-content></mat-card
            >
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@reports.grossProfit">Gross profit</p>
                <p class="metric">{{ s.grossProfit | number: '1.2-2' }}</p>
              </mat-card-content></mat-card
            >
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@reports.transactions">Transactions</p>
                <p class="metric">{{ s.transactionCount }}</p>
                <p class="muted">
                  <span i18n="@@reports.averageLabel">Average</span>:
                  {{ s.averageTransactionValue | number: '1.2-2' }}
                </p>
              </mat-card-content></mat-card
            >
          </div>
        } @else {
          <p class="muted" i18n="@@reports.prompt">Choose a date range and run the report.</p>
        }
      }

      @case ('products') {
        <form class="toolbar" (ngSubmit)="runProducts()" role="form">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.from">From</mat-label>
            <input matInput type="date" name="from" [(ngModel)]="fromDate" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@expenses.to">To</mat-label>
            <input matInput type="date" name="to" [(ngModel)]="toDate" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@reports.rankBy">Rank by</mat-label>
            <mat-select name="rank" [(ngModel)]="rankBy">
              <mat-option value="Quantity" i18n="@@reports.rank.quantity">Quantity sold</mat-option>
              <mat-option value="Revenue" i18n="@@reports.rank.revenue">Revenue</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="busy()" i18n="@@report.run">
            Run report
          </button>
        </form>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" class="loading-bar" />
        } @else if (error(); as message) {
          <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message" />
        } @else if (products().length) {
          <div class="table-card">
            <table mat-table [dataSource]="products()" class="data-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Product</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button type="button" (click)="showVariants(row)">
                    {{ row.productName }}
                  </button>
                </td>
              </ng-container>
              <ng-container matColumnDef="sold">
                <th mat-header-cell *matHeaderCellDef i18n="@@reports.sold">Sold</th>
                <td mat-cell *matCellDef="let row">{{ row.grossQuantitySold }}</td>
              </ng-container>
              <ng-container matColumnDef="returned">
                <th mat-header-cell *matHeaderCellDef i18n="@@reports.returned">Returned</th>
                <td mat-cell *matCellDef="let row">{{ row.returnedQuantity }}</td>
              </ng-container>
              <ng-container matColumnDef="net">
                <th mat-header-cell *matHeaderCellDef i18n="@@reports.netQuantity">Net quantity</th>
                <td mat-cell *matCellDef="let row">{{ row.netQuantitySold }}</td>
              </ng-container>
              <ng-container matColumnDef="revenue">
                <th mat-header-cell *matHeaderCellDef i18n="@@reports.netRevenue">Net revenue</th>
                <td mat-cell *matCellDef="let row">{{ row.netRevenue | number: '1.2-2' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="productColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: productColumns"></tr>
            </table>
          </div>
          <app-pager [page]="page()" [hasNext]="hasNext()" (pageChange)="goToProducts($event)" />
          @if (variants().length) {
            <h2 class="section-title" i18n="@@reports.variants">Variants</h2>
            <div class="table-card">
              <table mat-table [dataSource]="variants()" class="data-table">
                <ng-container matColumnDef="sku">
                  <th mat-header-cell *matHeaderCellDef i18n="@@variants.sku">SKU</th>
                  <td mat-cell *matCellDef="let row">{{ row.sku }}</td>
                </ng-container>
                <ng-container matColumnDef="net">
                  <th mat-header-cell *matHeaderCellDef i18n="@@reports.netQuantity">
                    Net quantity
                  </th>
                  <td mat-cell *matCellDef="let row">{{ row.netQuantitySold }}</td>
                </ng-container>
                <ng-container matColumnDef="revenue">
                  <th mat-header-cell *matHeaderCellDef i18n="@@reports.netRevenue">Net revenue</th>
                  <td mat-cell *matCellDef="let row">{{ row.netRevenue | number: '1.2-2' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="variantColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: variantColumns"></tr>
              </table>
            </div>
          }
        } @else {
          <p class="muted" i18n="@@reports.noRows">No sales in this range.</p>
        }
      }

      @case ('inventory') {
        <form class="toolbar" (ngSubmit)="runInventory()" role="form">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@stock.field.location">Location</mat-label>
            <mat-select name="location" [(ngModel)]="locationId">
              <mat-option [value]="null" i18n="@@common.all">All locations</mat-option>
              @for (location of locations(); track location.id) {
                <mat-option [value]="location.id">{{ location.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-slide-toggle name="zero" [(ngModel)]="includeZero" i18n="@@documents.includeZero"
            >Include zero stock</mat-slide-toggle
          >
          <button mat-flat-button type="submit" [disabled]="busy()" i18n="@@report.run">
            Run report
          </button>
        </form>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" class="loading-bar" />
        } @else if (error(); as message) {
          <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message" />
        } @else if (inventory(); as r) {
          <div class="card-grid">
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@reports.variants">Variants</p>
                <p class="metric">{{ r.totalVariants }}</p>
              </mat-card-content></mat-card
            >
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@reports.onHand">Quantity on hand</p>
                <p class="metric">{{ r.totalQuantityOnHand }}</p>
              </mat-card-content></mat-card
            >
            <mat-card appearance="outlined"
              ><mat-card-content>
                <p class="label" i18n="@@reports.stockValue">Stock value</p>
                <p class="metric">{{ r.totalStockValue ?? r.knownStockValue | number: '1.2-2' }}</p>
                @if (r.unvaluedQuantity > 0) {
                  <p class="muted">
                    {{ r.unvaluedQuantity }}
                    <span i18n="@@reports.unvaluedWord">units have no cost recorded.</span>
                  </p>
                }
              </mat-card-content></mat-card
            >
          </div>
          <div class="table-card">
            <table mat-table [dataSource]="r.items" class="data-table">
              <ng-container matColumnDef="product">
                <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
                <td mat-cell *matCellDef="let row">{{ row.productName }} · {{ row.sku }}</td>
              </ng-container>
              <ng-container matColumnDef="qty">
                <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.onHand">On hand</th>
                <td mat-cell *matCellDef="let row">{{ row.quantityOnHand }}</td>
              </ng-container>
              <ng-container matColumnDef="cost">
                <th mat-header-cell *matHeaderCellDef i18n="@@reports.unitCost">Unit cost</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.unitCost === null ? '—' : (row.unitCost | number: '1.2-4') }}
                </td>
              </ng-container>
              <ng-container matColumnDef="value">
                <th mat-header-cell *matHeaderCellDef i18n="@@reports.value">Value</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.stockValue === null ? '—' : (row.stockValue | number: '1.2-2') }}
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="inventoryColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: inventoryColumns"></tr>
            </table>
          </div>
          <app-pager [page]="page()" [hasNext]="hasNext()" (pageChange)="goToInventory($event)" />
        } @else {
          <p class="muted" i18n="@@reports.prompt">Run the report to see stock.</p>
        }
      }

      @case ('lowStock') {
        <form class="toolbar" (ngSubmit)="runLowStock()" role="form">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@stock.field.location">Location</mat-label>
            <mat-select name="location" [(ngModel)]="locationId">
              <mat-option [value]="null" i18n="@@common.all">All locations</mat-option>
              @for (location of locations(); track location.id) {
                <mat-option [value]="location.id">{{ location.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="busy()" i18n="@@report.run">
            Run report
          </button>
        </form>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" class="loading-bar" />
        } @else if (error(); as message) {
          <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message" />
        } @else if (lowStock(); as r) {
          <p class="total-line">
            <span i18n="@@reports.lowStockTotal">Items below reorder point</span>:
            <strong>{{ r.totalItems }}</strong>
          </p>
          @if (r.items.length === 0) {
            <app-state-panel icon="inventory" [title]="noLowTitle" [message]="noLowMessage" />
          } @else {
            <div class="table-card">
              <table mat-table [dataSource]="r.items" class="data-table">
                <ng-container matColumnDef="product">
                  <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
                  <td mat-cell *matCellDef="let row">{{ row.productName }} · {{ row.sku }}</td>
                </ng-container>
                <ng-container matColumnDef="location">
                  <th mat-header-cell *matHeaderCellDef i18n="@@stock.field.location">Location</th>
                  <td mat-cell *matCellDef="let row">{{ row.locationName }}</td>
                </ng-container>
                <ng-container matColumnDef="qty">
                  <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.onHand">On hand</th>
                  <td mat-cell *matCellDef="let row">{{ row.quantityOnHand }}</td>
                </ng-container>
                <ng-container matColumnDef="reorder">
                  <th mat-header-cell *matHeaderCellDef i18n="@@policies.reorderPoint">
                    Reorder point
                  </th>
                  <td mat-cell *matCellDef="let row">{{ row.reorderPoint }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="lowColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: lowColumns"></tr>
              </table>
            </div>
            <app-pager [page]="page()" [hasNext]="hasNext()" (pageChange)="goToLowStock($event)" />
          }
        } @else {
          <p class="muted" i18n="@@reports.prompt">Run the report to see low stock.</p>
        }
      }
    }
  `,
  styles: `
    .card-grid mat-card p {
      margin: 0;
    }
    .label {
      color: var(--mat-sys-on-surface-variant);
    }
    .metric {
      font: var(--mat-sys-headline-small);
    }
    .total-line {
      text-align: end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly api = inject(ReportsApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly kind = signal<ReportKind>(
    (this.route.snapshot.data['report'] as ReportKind | undefined) ?? 'sales',
  );
  readonly heading = signal(this.titleFor(this.kind()));
  readonly subtitle = signal(this.subtitleFor(this.kind()));
  readonly errorTitle = $localize`:@@reports.failed:The report could not be run`;
  readonly noLowTitle = $localize`:@@reports.noLow.title:Nothing is below its reorder point`;
  readonly noLowMessage = $localize`:@@reports.noLow.message:Items appear here when stock falls to or below the reorder point.`;
  readonly productColumns = ['name', 'sold', 'returned', 'net', 'revenue'];
  readonly variantColumns = ['sku', 'net', 'revenue'];
  readonly inventoryColumns = ['product', 'qty', 'cost', 'value'];
  readonly lowColumns = ['product', 'location', 'qty', 'reorder'];

  readonly locations = signal<Location[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sales = signal<SalesSummary | null>(null);
  readonly products = signal<ProductPerformance[]>([]);
  readonly variants = signal<VariantPerformance[]>([]);
  readonly inventory = signal<InventoryReport | null>(null);
  readonly lowStock = signal<LowStockReport | null>(null);
  readonly page = signal(1);
  readonly hasNext = signal(false);

  fromDate = dayText(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  toDate = dayText(new Date());
  rankBy: 'Quantity' | 'Revenue' = 'Quantity';
  locationId: string | null = null;
  salesLocationId: string | null = null;
  includeZero = false;
  private selectedProduct: string | null = null;

  constructor() {
    this.locationsApi.list().subscribe({
      next: (locations) => this.locations.set(locations),
      error: () => this.locations.set([]),
    });
  }

  runSales(): void {
    this.run(
      () => this.api.salesSummary(this.fromDate, this.toDate, this.salesLocationId),
      (value) => this.sales.set(value),
    );
  }

  runProducts(): void {
    this.page.set(1);
    this.selectedProduct = null;
    this.variants.set([]);
    this.loadProducts();
  }

  goToProducts(page: number): void {
    this.page.set(page);
    this.loadProducts();
  }

  showVariants(row: ProductPerformance): void {
    this.selectedProduct = row.productId;
    this.api.variantPerformance(row.productId, this.fromDate, this.toDate).subscribe({
      next: (variants) => this.variants.set(variants),
      error: (error: unknown) => this.error.set(describeApiError(error, this.errorTitle)),
    });
  }

  runInventory(): void {
    this.page.set(1);
    this.loadInventory();
  }

  goToInventory(page: number): void {
    this.page.set(page);
    this.loadInventory();
  }

  runLowStock(): void {
    this.page.set(1);
    this.loadLowStock();
  }

  goToLowStock(page: number): void {
    this.page.set(page);
    this.loadLowStock();
  }

  private loadProducts(): void {
    this.run(
      () =>
        this.api.productPerformance(this.fromDate, this.toDate, this.rankBy, {
          page: this.page(),
          pageSize,
        }),
      (rows) => {
        this.products.set(rows);
        this.hasNext.set(rows.length === pageSize);
        if (this.selectedProduct) {
          const row = rows.find((item) => item.productId === this.selectedProduct);
          if (row) {
            this.showVariants(row);
          }
        }
      },
    );
  }

  private loadInventory(): void {
    this.run(
      () => this.api.inventory(this.locationId, this.includeZero, { page: this.page(), pageSize }),
      (report) => {
        this.inventory.set(report);
        this.hasNext.set(report.items.length === pageSize);
      },
    );
  }

  private loadLowStock(): void {
    this.run(
      () => this.api.lowStock(this.locationId, { page: this.page(), pageSize }),
      (report) => {
        this.lowStock.set(report);
        this.hasNext.set(report.items.length === pageSize);
      },
    );
  }

  private run<T>(request: () => Observable<T>, apply: (value: T) => void): void {
    this.busy.set(true);
    this.error.set(null);
    request().subscribe({
      next: (value) => {
        apply(value);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(
          describeApiError(error, $localize`:@@reports.failedHint:Check the dates and try again.`),
        );
      },
    });
  }

  private titleFor(kind: ReportKind): string {
    switch (kind) {
      case 'products':
        return $localize`:@@reports.products.heading:Product performance`;
      case 'inventory':
        return $localize`:@@reports.inventory.heading:Inventory report`;
      case 'lowStock':
        return $localize`:@@reports.lowStock.heading:Low stock`;
      default:
        return $localize`:@@reports.sales.heading:Sales summary`;
    }
  }

  private subtitleFor(kind: ReportKind): string {
    switch (kind) {
      case 'products':
        return $localize`:@@reports.products.subtitle:Gross, returned and net sales per product. Select a product to see its variants.`;
      case 'inventory':
        return $localize`:@@reports.inventory.subtitle:Quantity on hand per variant, with value where a cost is recorded.`;
      case 'lowStock':
        return $localize`:@@reports.lowStock.subtitle:Variants at or below their reorder point at each location.`;
      default:
        return $localize`:@@reports.sales.subtitle:Revenue, cost and gross profit for completed sales. Dates are UTC.`;
    }
  }
}
