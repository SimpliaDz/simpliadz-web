import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { Supplier, SuppliersApiService } from '../data-access/suppliers-api.service';
import { SupplierDialogComponent, SupplierDialogData } from '../ui/supplier-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-suppliers-page',
  imports: [
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
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
      subtitle="Suppliers you buy stock from. Purchase orders are placed with a supplier."
      i18n-subtitle="@@suppliers.subtitle"
    >
      <button
        *appHasPermission="'suppliers.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@suppliers.create">New supplier</span>
      </button>
    </app-page-header>

    <form class="toolbar" (ngSubmit)="applySearch()" role="search">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label i18n="@@common.search">Search</mat-label>
        <input matInput name="search" [(ngModel)]="searchText" type="search" maxlength="150" />
      </mat-form-field>
      <mat-slide-toggle
        name="inactive"
        [(ngModel)]="includeInactive"
        (change)="applySearch()"
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
    } @else if (suppliers().length === 0) {
      <app-state-panel icon="contact_phone" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="suppliers()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let row">{{ row.name }}</td>
          </ng-container>
          <ng-container matColumnDef="contact">
            <th mat-header-cell *matHeaderCellDef i18n="@@suppliers.contact">Contact</th>
            <td mat-cell *matCellDef="let row" class="muted">
              {{ [row.phone, row.email].filter(hasValue).join(' · ') || '—' }}
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
                *appHasPermission="'suppliers.manage'"
                mat-icon-button
                type="button"
                (click)="openDialog(row)"
                [attr.aria-label]="editLabel + ' ' + row.name"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              @if (row.isActive) {
                <button
                  *appHasPermission="'suppliers.manage'"
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
export class SuppliersPage {
  private readonly api = inject(SuppliersApiService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@suppliers.heading:Suppliers`;
  readonly errorTitle = $localize`:@@suppliers.loadFailed:We could not load suppliers`;
  readonly emptyTitle = $localize`:@@suppliers.empty.title:No suppliers match`;
  readonly emptyMessage = $localize`:@@suppliers.empty.message:Add a supplier to start placing purchase orders.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;
  readonly columns = ['name', 'contact', 'status', 'actions'];

  readonly suppliers = signal<Supplier[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  searchText = '';
  includeInactive = true;
  private activeSearch: string | null = null;
  private activeInactive = true;

  constructor() {
    this.load();
  }

  hasValue(value: string | null): boolean {
    return !!value;
  }

  applySearch(): void {
    this.activeSearch = this.searchText.trim() || null;
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
        isActive: this.activeInactive ? null : true,
        page: this.page(),
        pageSize,
      })
      .subscribe({
        next: (suppliers) => {
          this.suppliers.set(suppliers);
          this.hasNext.set(suppliers.length === pageSize);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            describeApiError(error, $localize`:@@suppliers.loadFailedHint:Try again in a moment.`),
          );
        },
      });
  }

  openDialog(supplier: Supplier | null): void {
    const data: SupplierDialogData = { supplier };
    this.dialog
      .open(SupplierDialogComponent, { data, width: '36rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@suppliers.saved:Supplier saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  deactivate(supplier: Supplier): void {
    this.confirm
      .confirm({
        title: $localize`:@@suppliers.deactivate.title:Deactivate supplier?`,
        message: $localize`:@@suppliers.deactivate.message:Existing purchase orders stay as they are. The supplier can no longer be chosen for new orders. Suppliers cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivate(supplier.id).subscribe({
          next: () => {
            this.snackBar.open(
              $localize`:@@suppliers.deactivated:Supplier deactivated.`,
              undefined,
              { duration: 3000 },
            );
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@suppliers.deactivateFailed:The supplier could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }
}
