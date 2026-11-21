import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
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
import {
  PriceList,
  PriceListsApiService,
} from '../../../inventory/price-lists/data-access/price-lists-api.service';
import { Customer, CustomersApiService } from '../../customers/data-access/customers-api.service';
import { Sale, SaleFilter, SaleStatus, SalesApiService } from '../data-access/sales-api.service';
import { NewSaleDialogComponent, NewSaleDialogData } from '../ui/new-sale-dialog.component';

const pageSize = 50;
const statuses: SaleStatus[] = ['Draft', 'Completed', 'PartiallyReturned', 'Returned', 'Cancelled'];

@Component({
  selector: 'app-sales-page',
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
      subtitle="Point-of-sale receipts. A sale is a draft until it is completed and paid."
      i18n-subtitle="@@sales.subtitle"
    >
      <button *appHasPermission="'sales.manage'" mat-flat-button type="button" (click)="openNew()">
        <mat-icon aria-hidden="true">point_of_sale</mat-icon>
        <span i18n="@@sales.create">New sale</span>
      </button>
    </app-page-header>

    <div class="toolbar">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@stock.field.location">Location</mat-label>
        <mat-select [value]="locationId()" (selectionChange)="setFilter('location', $event.value)">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (location of locations(); track location.id) {
            <mat-option [value]="location.id">{{ location.name }}</mat-option>
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
    } @else if (sales().length === 0) {
      <app-state-panel icon="receipt" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="sales()" class="data-table">
          <ng-container matColumnDef="number">
            <th mat-header-cell *matHeaderCellDef i18n="@@sales.number">Sale</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/app/sales/sales', row.id]">{{ row.saleNumber ?? draftLabel }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef i18n="@@sales.date">Date</th>
            <td mat-cell *matCellDef="let row">{{ row.saleDate | date: 'medium' }}</td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.field.location">Location</th>
            <td mat-cell *matCellDef="let row">{{ locationName(row.locationId) }}</td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef i18n="@@sales.total">Total</th>
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
export class SalesPage {
  private readonly api = inject(SalesApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly priceListsApi = inject(PriceListsApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly heading = $localize`:@@sales.heading:Sales`;
  readonly errorTitle = $localize`:@@sales.loadFailed:We could not load sales`;
  readonly emptyTitle = $localize`:@@sales.empty.title:No sales match`;
  readonly emptyMessage = $localize`:@@sales.empty.message:Start a new sale to ring up a customer.`;
  readonly draftLabel = $localize`:@@sales.draft:Draft`;
  readonly columns = ['number', 'date', 'location', 'total', 'status'];
  readonly statusOptions = statuses;

  readonly sales = signal<Sale[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly priceLists = signal<PriceList[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly locationId = signal<string | null>(null);
  readonly status = signal<SaleStatus | null>(null);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly canStart = computed(() => this.locations().length > 0);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const filter: SaleFilter = {
      locationId: this.locationId(),
      customerId: null,
      status: this.status(),
      page: this.page(),
      pageSize,
    };
    forkJoin({
      sales: this.api.list(filter),
      locations: this.locationsApi.list(),
      priceLists: this.priceListsApi.list(),
      customers: this.customersApi.list({
        search: null,
        customerType: null,
        isActive: true,
        page: 1,
        pageSize: 100,
      }),
    }).subscribe({
      next: ({ sales, locations, priceLists, customers }) => {
        this.sales.set(sales);
        this.locations.set(locations);
        this.priceLists.set(priceLists);
        this.customers.set(customers);
        this.hasNext.set(sales.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@sales.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  setFilter(kind: 'location' | 'status', value: string | null): void {
    if (kind === 'location') {
      this.locationId.set(value);
    } else {
      this.status.set(value as SaleStatus | null);
    }
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  openNew(): void {
    const data: NewSaleDialogData = {
      locations: this.locations(),
      priceLists: this.priceLists(),
      customers: this.customers(),
    };
    this.dialog
      .open<NewSaleDialogComponent, NewSaleDialogData, Sale>(NewSaleDialogComponent, {
        data,
        width: '34rem',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((sale) => {
        if (sale) {
          void this.router.navigate(['/app/sales/sales', sale.id]);
        }
      });
  }

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }

  statusLabel(status: SaleStatus): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@sales.status.draft:Draft`;
      case 'Completed':
        return $localize`:@@sales.status.completed:Completed`;
      case 'PartiallyReturned':
        return $localize`:@@sales.status.partial:Partly returned`;
      case 'Returned':
        return $localize`:@@sales.status.returned:Returned`;
      case 'Cancelled':
        return $localize`:@@sales.status.cancelled:Cancelled`;
    }
  }

  tone(status: SaleStatus): StatusTone {
    return status === 'Completed'
      ? 'success'
      : status === 'Cancelled' || status === 'Returned'
        ? 'warning'
        : 'neutral';
  }
}
