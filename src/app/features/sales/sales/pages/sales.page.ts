import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
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
import { Sale, SaleFilter, SaleStatus, SalesApiService } from '../data-access/sales-api.service';

const pageSize = 50;
const statuses: SaleStatus[] = ['Draft', 'Completed', 'PartiallyReturned', 'Returned', 'Cancelled'];

@Component({
  selector: 'app-sales-page',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
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
      subtitle="Search sale history and download the associated business documents. Sales are created and paid in Point of Sale."
      i18n-subtitle="@@sales.subtitle"
    />

    <div class="toolbar">
      <mat-form-field appearance="outline">
        <mat-label>Search sale or customer</mat-label>
        <input matInput name="saleSearch" [(ngModel)]="search" maxlength="150" (keyup.enter)="runSearch()" placeholder="Sale ID, number, customer, phone or email" />
      </mat-form-field>
      <button mat-stroked-button type="button" (click)="runSearch()">Search</button>
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
          <ng-container matColumnDef="documents">
            <th mat-header-cell *matHeaderCellDef>Documents</th>
            <td mat-cell *matCellDef="let row">
              <button mat-button type="button" (click)="downloadProForma(row)">Pro-forma</button>
              @if (row.status === 'Completed' || row.status === 'PartiallyReturned' || row.status === 'Returned') {
                <button mat-button type="button" (click)="downloadReceipt(row)">Receipt</button>
              }
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

  readonly heading = $localize`:@@sales.heading:Sales`;
  readonly errorTitle = $localize`:@@sales.loadFailed:We could not load sales`;
  readonly emptyTitle = $localize`:@@sales.empty.title:No sales match`;
  readonly emptyMessage = $localize`:@@sales.empty.message:Try changing the search or filters.`;
  readonly draftLabel = $localize`:@@sales.draft:Draft`;
  readonly columns = ['number', 'date', 'location', 'total', 'status', 'documents'];
  readonly statusOptions = statuses;

  readonly sales = signal<Sale[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly locationId = signal<string | null>(null);
  readonly status = signal<SaleStatus | null>(null);
  search = '';
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

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
      search: this.search.trim() || null,
      page: this.page(),
      pageSize,
    };
    forkJoin({
      sales: this.api.list(filter),
      locations: this.locationsApi.list(),
    }).subscribe({
      next: ({ sales, locations }) => {
        this.sales.set(sales);
        this.locations.set(locations);
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

  runSearch(): void {
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  downloadProForma(sale: Sale): void {
    this.download(this.api.proFormaPdf(sale.id), `pro-forma-${sale.saleNumber ?? sale.id}.pdf`);
  }

  downloadReceipt(sale: Sale): void {
    this.download(this.api.receiptPdf(sale.id), `receipt-${sale.saleNumber ?? sale.id}.pdf`);
  }

  private download(request: ReturnType<SalesApiService['proFormaPdf']>, name: string): void {
    request.subscribe({
      next: (content) => {
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: unknown) => this.loadError.set(describeApiError(error, 'The PDF could not be generated.')),
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
