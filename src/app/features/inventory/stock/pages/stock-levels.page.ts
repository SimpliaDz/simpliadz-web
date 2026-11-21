import { DatePipe } from '@angular/common';
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
import { StockApiService, StockBalance } from '../data-access/stock-api.service';
import { VariantCatalogueService, VariantOption } from '../data-access/variant-catalogue.service';
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
              {{ row.variant?.label ?? row.balance.productVariantId }}
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
  readonly columns = ['product', 'quantity', 'state', 'updated'];

  readonly canManage = computed(() => this.session.hasPermission('stock.manage'));
  readonly locations = signal<Location[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly locationId = signal<string | null>(null);
  readonly balances = signal<StockBalance[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly rows = computed<BalanceRow[]>(() => {
    const byId = new Map(this.variants().map((variant) => [variant.id, variant]));
    return this.balances().map((balance) => ({
      balance,
      variant: byId.get(balance.productVariantId) ?? null,
    }));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      locations: this.locationsApi.list(),
      variants: this.catalogue.options(),
    }).subscribe({
      next: ({ locations, variants }) => {
        this.locations.set(locations);
        this.variants.set(variants);
        const first = locations.find((location) => location.isActive) ?? locations[0] ?? null;
        this.locationId.set(this.locationId() ?? first?.id ?? null);
        this.loadBalances();
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
    this.loadBalances();
  }

  openDialog(mode: StockMovementMode): void {
    const data: StockMovementDialogData = {
      mode,
      variants: this.variants(),
      locations: this.locations(),
      variantId: null,
      locationId: this.locationId(),
    };
    this.dialog
      .open(StockMovementDialogComponent, { data, width: '32rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@stock.saved:Stock updated.`, undefined, {
            duration: 3000,
          });
          this.loadBalances();
        }
      });
  }

  private loadBalances(): void {
    const id = this.locationId();
    if (!id) {
      this.balances.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.stock.balancesForLocation(id).subscribe({
      next: (balances) => {
        this.balances.set(balances);
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
}
