import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Location, LocationsApiService } from '../../locations/data-access/locations-api.service';
import { StockApiService, StockBalance, StockOverview } from '../data-access/stock-api.service';
import { matchesVariant, VariantCatalogueService, VariantOption } from '../data-access/variant-catalogue.service';
import {
  StockMovementDialogComponent,
  StockMovementDialogData,
  StockMovementMode,
} from '../ui/stock-movement-dialog.component';

interface BalanceRow {
  readonly balance: StockBalance;
  readonly variant: VariantOption | null;
}

@Component({
  selector: 'app-stock-levels-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Stock is held per product variant at each location. Products do not own quantities."
      i18n-subtitle="@@stock.subtitle"
    >
      @if (canManage() && locationId()) {
        <button mat-stroked-button type="button" (click)="openDialog('opening')">
          <span i18n="@@stock.opening.action">Opening stock</span>
        </button>
        <button mat-stroked-button type="button" (click)="openDialog('adjustment')">
          <span i18n="@@stock.adjust.action">Adjust</span>
        </button>
        <button mat-flat-button type="button" (click)="openDialog('receipt')">
          <mat-icon aria-hidden="true">move_to_inbox</mat-icon>
          <span i18n="@@stock.receipt.action">Receive stock</span>
        </button>
      }
    </app-page-header>

    <div class="toolbar">
      <mat-form-field appearance="outline">
        <mat-label>Find a variant</mat-label>
        <input matInput #query (input)="search.set(query.value)" placeholder="Name, attributes, SKU or barcode" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@stock.field.location">Location</mat-label>
        <mat-select [value]="locationId()" (selectionChange)="selectLocation($event.value)">
          @for (location of locations(); track location.id) {
            <mat-option [value]="location.id">{{ location.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (locations().length === 0) {
      <app-state-panel icon="store" [title]="noLocationTitle" [message]="noLocationMessage" />
    } @else if (rows().length === 0) {
      <app-state-panel icon="inventory" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="rows()" class="data-table">
          <ng-container matColumnDef="product">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
            <td mat-cell *matCellDef="let row">
              @if (row.variant; as variant) {
                <a [routerLink]="['/app/catalogue/variants', variant.id]">{{ variant.label }}</a>
              } @else { {{ row.balance.productVariantId }} }
            </td>
          </ng-container>
          <ng-container matColumnDef="otherLocations">
            <th mat-header-cell *matHeaderCellDef>Other locations</th>
            <td mat-cell *matCellDef="let row">
              @for (location of otherLocations(); track location.id) {
                <div>{{ location.name }} · {{ onHand(row.balance.productVariantId, location.id) }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="prices">
            <th mat-header-cell *matHeaderCellDef>Prices</th>
            <td mat-cell *matCellDef="let row">
              @for (price of pricesByVariant().get(row.balance.productVariantId) ?? []; track $index) {
                <div>{{ price.priceListName }} · {{ price.price | number:'1.2-2' }}</div>
              } @empty { — }
            </td>
          </ng-container>
          <ng-container matColumnDef="quantity">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.onHand">On hand</th>
            <td mat-cell *matCellDef="let row">{{ row.balance.quantityOnHand }}</td>
          </ng-container>
          <ng-container matColumnDef="state">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              @if (row.balance.quantityOnHand <= 0) {
                <app-status-chip [label]="outLabel" tone="warning" />
              } @else {
                <app-status-chip [label]="inStockLabel" tone="success" />
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="updated">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.updated">Updated</th>
            <td mat-cell *matCellDef="let row">{{ row.balance.updatedAt | date: 'medium' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockLevelsPage {
  private readonly stock = inject(StockApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly catalogue = inject(VariantCatalogueService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);

  readonly heading = $localize`:@@stock.heading:Stock levels`;
  readonly errorTitle = $localize`:@@stock.loadFailed:We could not load stock`;
  readonly noLocationTitle = $localize`:@@stock.noLocation.title:No locations yet`;
  readonly noLocationMessage = $localize`:@@stock.noLocation.message:Create a location before recording stock.`;
  readonly emptyTitle = $localize`:@@stock.empty.title:No stock recorded here`;
  readonly emptyMessage = $localize`:@@stock.empty.message:Record opening stock or receive goods to start tracking quantities at this location.`;
  readonly outLabel = $localize`:@@stock.out:Out of stock`;
  readonly inStockLabel = $localize`:@@stock.inStock:In stock`;
  readonly columns = ['product', 'quantity', 'otherLocations', 'prices', 'state', 'updated'];

  readonly canManage = computed(() => this.session.hasPermission('stock.manage'));
  readonly locations = signal<Location[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly locationId = signal<string | null>(null);
  readonly balances = signal<StockBalance[]>([]);
  readonly search = signal('');
  private readonly prices = signal<StockOverview['prices']>([]);
  readonly pricesByVariant = computed(() => {
    const result = new Map<string, StockOverview['prices']>();
    for (const price of this.prices()) {
      const items = result.get(price.productVariantId) ?? [];
      items.push(price);
      result.set(price.productVariantId, items);
    }
    return result;
  });
  readonly otherLocations = computed(() => this.locations().filter(location => location.id !== this.locationId()));
  private readonly balancesByKey = computed(() => new Map(this.balances().map(balance =>
    [`${balance.productVariantId}:${balance.locationId}`, balance])));
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly rows = computed<BalanceRow[]>(() => {
    const locationId = this.locationId();
    if (!locationId) return [];
    return this.variants().filter(variant => matchesVariant(variant, this.search())).map(variant => ({
      variant,
      balance: this.balancesByKey().get(`${variant.id}:${locationId}`) ??
        { productVariantId: variant.id, locationId, quantityOnHand: 0, updatedAt: '' },
    }));
  });

  onHand(variantId: string, locationId: string): number {
    return this.balancesByKey().get(`${variantId}:${locationId}`)?.quantityOnHand ?? 0;
  }

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      locations: this.locationsApi.list(),
      variants: this.catalogue.options(),
      overview: this.stock.overview(),
    }).subscribe({
      next: ({ locations, variants, overview }) => {
        this.locations.set(locations);
        const attributes = new Map(overview.attributes.map(item => [item.productVariantId, item.values]));
        this.variants.set(variants.map(variant => {
          const values = attributes.get(variant.id);
          return values?.length ? { ...variant, label: `${variant.productName} (${values.join(' / ')}) · ${variant.sku}` } : variant;
        }));
        this.balances.set(overview.balances);
        this.prices.set(overview.prices);
        const first = locations.find((location) => location.isActive) ?? locations[0] ?? null;
        this.locationId.set(this.locationId() ?? first?.id ?? null);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@stock.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  selectLocation(id: string): void {
    this.locationId.set(id);
  }

  openDialog(mode: StockMovementMode): void {
    const data: StockMovementDialogData = {
      mode,
      variants: this.variants(),
      locations: this.locations(),
      variantId: null,
      locationId: this.locationId(),
      balances: this.balances(),
    };
    this.dialog
      .open(StockMovementDialogComponent, { data, width: '32rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@stock.saved:Stock updated.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

}
