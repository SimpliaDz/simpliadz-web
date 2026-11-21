import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Customer, CustomersApiService, CustomerType } from '../data-access/customers-api.service';
import { CustomerDialogComponent, CustomerDialogData } from '../ui/customer-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-customers-page',
  imports: [
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Customers you sell to. Wholesale customers are priced from wholesale lists."
      i18n-subtitle="@@customers.subtitle"
    >
      <button
        *appHasPermission="'customers.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@customers.create">New customer</span>
      </button>
    </app-page-header>

    <form class="toolbar" (ngSubmit)="applyFilters()" role="search">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label i18n="@@common.search">Search</mat-label>
        <input matInput name="search" [(ngModel)]="searchText" type="search" maxlength="150" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@customers.field.type">Customer type</mat-label>
        <mat-select name="type" [(ngModel)]="typeFilter">
          <mat-option value="all" i18n="@@common.all">All</mat-option>
          <mat-option value="Retail" i18n="@@priceLists.type.retail">Retail</mat-option>
          <mat-option value="Wholesale" i18n="@@priceLists.type.wholesale">Wholesale</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-slide-toggle
        name="inactive"
        [(ngModel)]="includeInactive"
        (change)="applyFilters()"
        i18n="@@common.showInactive"
      >
        Show inactive
      </mat-slide-toggle>
      <button mat-stroked-button type="submit" i18n="@@common.apply">Apply</button>
    </form>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (customers().length === 0) {
      <app-state-panel icon="group" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="customers()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let row">{{ row.name }}</td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef i18n="@@customers.field.type">Customer type</th>
            <td mat-cell *matCellDef="let row">
              <app-status-chip [label]="typeLabel(row.customerType)" tone="neutral" />
            </td>
          </ng-container>
          <ng-container matColumnDef="contact">
            <th mat-header-cell *matHeaderCellDef i18n="@@suppliers.contact">Contact</th>
            <td mat-cell *matCellDef="let row" class="muted">
              {{ row.phone ?? row.email ?? '—' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-chip
                [label]="row.isActive ? activeLabel : inactiveLabel"
                [tone]="row.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button
                *appHasPermission="'customers.manage'"
                mat-icon-button
                type="button"
                (click)="openDialog(row)"
                [attr.aria-label]="editLabel + ' ' + row.name"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              @if (row.isActive) {
                <button
                  *appHasPermission="'customers.manage'"
                  mat-icon-button
                  type="button"
                  (click)="deactivate(row)"
                  [attr.aria-label]="deactivateLabel + ' ' + row.name"
                >
                  <mat-icon aria-hidden="true">block</mat-icon>
                </button>
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
export class CustomersPage {
  private readonly api = inject(CustomersApiService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@customers.heading:Customers`;
  readonly errorTitle = $localize`:@@customers.loadFailed:We could not load customers`;
  readonly emptyTitle = $localize`:@@customers.empty.title:No customers match`;
  readonly emptyMessage = $localize`:@@customers.empty.message:Add a customer, or sell to a walk-in without one.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;
  readonly columns = ['name', 'type', 'contact', 'status', 'actions'];

  readonly customers = signal<Customer[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  searchText = '';
  typeFilter: 'all' | CustomerType = 'all';
  includeInactive = true;
  private activeSearch: string | null = null;
  private activeType: CustomerType | null = null;
  private activeInactive = true;

  constructor() {
    this.load();
  }

  applyFilters(): void {
    this.activeSearch = this.searchText.trim() || null;
    this.activeType = this.typeFilter === 'all' ? null : this.typeFilter;
    this.activeInactive = this.includeInactive;
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .list({
        search: this.activeSearch,
        customerType: this.activeType,
        isActive: this.activeInactive ? null : true,
        page: this.page(),
        pageSize,
      })
      .subscribe({
        next: (customers) => {
          this.customers.set(customers);
          this.hasNext.set(customers.length === pageSize);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            describeApiError(error, $localize`:@@customers.loadFailedHint:Try again in a moment.`),
          );
        },
      });
  }

  openDialog(customer: Customer | null): void {
    const data: CustomerDialogData = { customer };
    this.dialog
      .open(CustomerDialogComponent, { data, width: '36rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@customers.saved:Customer saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  deactivate(customer: Customer): void {
    this.confirm
      .confirm({
        title: $localize`:@@customers.deactivate.title:Deactivate customer?`,
        message: $localize`:@@customers.deactivate.message:Past sales keep this customer. They can no longer be chosen for new sales. Customers cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivate(customer.id).subscribe({
          next: () => {
            this.snackBar.open(
              $localize`:@@customers.deactivated:Customer deactivated.`,
              undefined,
              { duration: 3000 },
            );
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@customers.deactivateFailed:The customer could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }

  typeLabel(type: CustomerType): string {
    return type === 'Retail'
      ? $localize`:@@priceLists.type.retail:Retail`
      : $localize`:@@priceLists.type.wholesale:Wholesale`;
  }
}
