import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import {
  StatusChipComponent,
  StatusTone,
} from '../../../../shared/ui/status-chip/status-chip.component';
import {
  Location,
  LocationsApiService,
} from '../../../inventory/locations/data-access/locations-api.service';
import { Supplier, SuppliersApiService } from '../../suppliers/data-access/suppliers-api.service';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrdersApiService,
} from '../data-access/purchase-orders-api.service';
import {
  PurchaseOrderDialogComponent,
  PurchaseOrderDialogData,
} from '../ui/purchase-order-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-purchase-orders-page',
  imports: [
    DatePipe,
    DecimalPipe,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    RouterLink,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Orders to suppliers. Stock goes up only when goods are received against an order."
      i18n-subtitle="@@orders.subtitle"
    >
      <button
        *appHasPermission="'purchase-orders.manage'"
        mat-flat-button
        type="button"
        (click)="openCreate()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@orders.create">New purchase order</span>
      </button>
    </app-page-header>

    <div class="toolbar">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@orders.field.supplier">Supplier</mat-label>
        <mat-select [value]="supplierId()" (selectionChange)="setFilter('supplier', $event.value)">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (supplier of suppliers(); track supplier.id) {
            <mat-option [value]="supplier.id">{{ supplier.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@common.status">Status</mat-label>
        <mat-select [value]="status()" (selectionChange)="setFilter('status', $event.value)">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (option of statusOptions; track option) {
            <mat-option [value]="option">{{ statusLabel(option) }}</mat-option>
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
    } @else if (orders().length === 0) {
      <app-state-panel icon="receipt_long" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="orders()" class="data-table">
          <ng-container matColumnDef="number">
            <th mat-header-cell *matHeaderCellDef i18n="@@orders.number">Number</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/app/purchasing/orders', row.id]">{{ row.purchaseOrderNumber }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="supplier">
            <th mat-header-cell *matHeaderCellDef i18n="@@orders.field.supplier">Supplier</th>
            <td mat-cell *matCellDef="let row">{{ supplierName(row.supplierId) }}</td>
          </ng-container>
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef i18n="@@orders.date">Date</th>
            <td mat-cell *matCellDef="let row">{{ row.orderDate | date: 'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef i18n="@@orders.total">Total</th>
            <td mat-cell *matCellDef="let row">{{ row.total | number: '1.2-2' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-chip [label]="statusLabel(row.status)" [tone]="tone(row.status)" />
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
      <app-pager [page]="page()" [hasNext]="hasNext()" (pageChange)="goTo($event)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrdersPage {
  private readonly api = inject(PurchaseOrdersApiService);
  private readonly suppliersApi = inject(SuppliersApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly heading = $localize`:@@orders.heading:Purchase orders`;
  readonly errorTitle = $localize`:@@orders.loadFailed:We could not load purchase orders`;
  readonly emptyTitle = $localize`:@@orders.empty.title:No purchase orders`;
  readonly emptyMessage = $localize`:@@orders.empty.message:Create an order for a supplier to start buying stock.`;
  readonly columns = ['number', 'supplier', 'date', 'total', 'status'];
  readonly statusOptions: PurchaseOrderStatus[] = [
    'Draft',
    'Ordered',
    'PartiallyReceived',
    'Received',
    'Cancelled',
  ];

  readonly orders = signal<PurchaseOrder[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly supplierId = signal<string | null>(null);
  readonly status = signal<PurchaseOrderStatus | null>(null);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly supplierNames = computed(() => new Map(this.suppliers().map((s) => [s.id, s.name])));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      orders: this.api.list({
        supplierId: this.supplierId(),
        status: this.status(),
        page: this.page(),
        pageSize,
      }),
      suppliers: this.suppliersApi.list({ search: null, isActive: null, page: 1, pageSize: 100 }),
      locations: this.locationsApi.list(),
    }).subscribe({
      next: ({ orders, suppliers, locations }) => {
        this.orders.set(orders);
        this.suppliers.set(suppliers);
        this.locations.set(locations);
        this.hasNext.set(orders.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@orders.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  setFilter(kind: 'supplier' | 'status', value: string | null): void {
    if (kind === 'supplier') {
      this.supplierId.set(value);
    } else {
      this.status.set(value as PurchaseOrderStatus | null);
    }
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  openCreate(): void {
    const data: PurchaseOrderDialogData = {
      suppliers: this.suppliers().filter((supplier) => supplier.isActive),
      locations: this.locations(),
    };
    this.dialog
      .open<PurchaseOrderDialogComponent, PurchaseOrderDialogData, PurchaseOrder>(
        PurchaseOrderDialogComponent,
        {
          data,
          width: '34rem',
          autoFocus: 'dialog',
        },
      )
      .afterClosed()
      .subscribe((order) => {
        if (order) {
          void this.router.navigate(['/app/purchasing/orders', order.id]);
        }
      });
  }

  supplierName(id: string): string {
    return this.supplierNames().get(id) ?? id;
  }

  statusLabel(status: PurchaseOrderStatus): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@orders.status.draft:Draft`;
      case 'Ordered':
        return $localize`:@@orders.status.ordered:Ordered`;
      case 'PartiallyReceived':
        return $localize`:@@orders.status.partial:Partly received`;
      case 'Received':
        return $localize`:@@orders.status.received:Received`;
      case 'Cancelled':
        return $localize`:@@orders.status.cancelled:Cancelled`;
    }
  }

  tone(status: PurchaseOrderStatus): StatusTone {
    return status === 'Received' ? 'success' : status === 'Cancelled' ? 'warning' : 'neutral';
  }
}
