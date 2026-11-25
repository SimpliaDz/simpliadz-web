import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
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
import { Sale, SaleFilter, SaleHistoryCustomer, SaleStatus, SalesApiService } from '../data-access/sales-api.service';

const pageSize = 50;
const statuses: SaleStatus[] = ['Draft', 'Completed', 'PartiallyReturned', 'Returned', 'Cancelled'];

@Component({
  selector: 'app-sales-page',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatAutocompleteModule,
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

    <form class="sales-filters" (ngSubmit)="runSearch()" #filters="ngForm">
      <mat-form-field appearance="outline">
        <mat-label>Search sale or customer</mat-label>
        <input matInput name="saleSearch" [(ngModel)]="search" maxlength="150" placeholder="Sale ID, number, customer, phone or email" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Customer</mat-label>
        <input matInput name="customer" [(ngModel)]="customer" (ngModelChange)="findCustomers($event)"
          (focus)="findCustomers(customer || '')" [matAutocomplete]="customerOptions" maxlength="150" />
        <mat-autocomplete #customerOptions="matAutocomplete" [displayWith]="customerName">
          @for (option of customers(); track option.id) {
            <mat-option [value]="option">{{ option.name }} · {{ option.id.slice(0, 8) }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>From date</mat-label>
        <input matInput type="date" name="fromDate" [(ngModel)]="fromDate" [attr.max]="toDate || null" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Through date</mat-label>
        <input matInput type="date" name="toDate" [(ngModel)]="toDate" [attr.min]="fromDate || null" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@stock.field.location">Location</mat-label>
        <mat-select name="locationId" [(ngModel)]="locationId">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (location of locations(); track location.id) {
            <mat-option [value]="location.id">{{ location.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@common.status">Status</mat-label>
        <mat-select name="status" [(ngModel)]="status">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (option of statusOptions; track option) {
            <mat-option [value]="option">{{ statusLabel(option) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <div class="filter-actions">
        <button mat-flat-button type="submit" [disabled]="filters.invalid || rangeInvalid() || customerSelectionPending()">Apply filters</button>
        <button mat-button type="button" (click)="clearFilters()">Clear filters</button>
      </div>
    </form>
    @if (rangeInvalid()) { <p role="alert">Choose an end date on or after the start date.</p> }
    @if (customerSelectionPending()) { <p>Select a customer from the suggestions or clear the field.</p> }

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else {
      <p aria-live="polite">{{ count() | number }} matching sales · Total {{ total() | number:'1.2-2' }}</p>
    }
    @if (!loading() && !loadError() && sales().length === 0) {
      <app-state-panel icon="receipt" [title]="emptyTitle" [message]="emptyMessage" />
    } @else if (!loading() && !loadError()) {
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
              @if (row.status === 'Completed') {
                <button mat-button type="button" (click)="downloadProForma(row)">Pro-forma</button>
              }
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
  styles: `
    .sales-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: .5rem 1rem; }
    .sales-filters mat-form-field { min-width: 0; width: 100%; }
    .filter-actions { display: flex; flex-wrap: wrap; align-items: flex-start; gap: .5rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesPage {
  private readonly api = inject(SalesApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private customerRequest?: Subscription;

  readonly heading = $localize`:@@sales.heading:Sales`;
  readonly errorTitle = $localize`:@@sales.loadFailed:We could not load sales`;
  readonly emptyTitle = $localize`:@@sales.empty.title:No sales match`;
  readonly emptyMessage = $localize`:@@sales.empty.message:Try changing the search or filters.`;
  readonly draftLabel = $localize`:@@sales.draft:Draft`;
  readonly columns = ['number', 'date', 'location', 'total', 'status', 'documents'];
  readonly statusOptions = statuses;

  readonly sales = signal<Sale[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly customers = signal<SaleHistoryCustomer[]>([]);
  readonly count = signal(0);
  readonly total = signal(0);
  locationId: string | null = null;
  status: SaleStatus | null = null;
  customer: SaleHistoryCustomer | string | null = null;
  fromDate = '';
  toDate = '';
  private applied = { locationId: null, customerId: null, status: null, search: null, from: null, until: null } as
    Omit<SaleFilter, 'page' | 'pageSize'> & { from: string | null; until: string | null };
  search = '';
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    this.locationsApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: locations => this.locations.set(locations),
      error: () => this.locations.set([]),
    });
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    const { from, until, ...filter } = this.applied;
    this.request = this.api.history({ ...filter, page: this.page(), pageSize }, from, until)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items, count, total }) => {
        this.sales.set(items);
        this.count.set(count);
        this.total.set(total);
        this.hasNext.set(this.page() * pageSize < count);
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

  readonly customerName = (customer: SaleHistoryCustomer | string | null) =>
    typeof customer === 'string' ? customer : customer?.name ?? '';

  findCustomers(value: SaleHistoryCustomer | string | null): void {
    this.customerRequest?.unsubscribe();
    if (typeof value !== 'string' && value !== null) return;
    this.customers.set([]);
    this.customerRequest = this.api.historyCustomers(value?.trim() ?? '')
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: customers => this.customers.set(customers),
        error: () => this.customers.set([]),
      });
  }

  rangeInvalid(): boolean {
    return Boolean(this.fromDate && this.toDate && this.fromDate > this.toDate);
  }

  customerSelectionPending(): boolean {
    return typeof this.customer === 'string' && this.customer.trim().length > 0;
  }

  runSearch(): void {
    if (this.rangeInvalid() || this.customerSelectionPending()) return;
    this.applied = {
      locationId: this.locationId,
      customerId: typeof this.customer === 'object' ? this.customer?.id ?? null : null,
      status: this.status,
      search: this.search.trim() || null,
      from: this.dayBoundary(this.fromDate),
      until: this.dayBoundary(this.toDate, 1),
    };
    this.page.set(1);
    this.load();
  }

  clearFilters(): void {
    this.locationId = this.status = this.customer = null;
    this.search = this.fromDate = this.toDate = '';
    this.runSearch();
  }

  private dayBoundary(value: string, offset = 0): string | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + offset);
    return date.toISOString();
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
