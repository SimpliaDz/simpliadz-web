import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { MatInputModule } from '@angular/material/input';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { PriceList, PriceListsApiService } from '../data-access/price-lists-api.service';
import { PriceListDialogComponent } from '../ui/price-list-dialog.component';

@Component({
  selector: 'app-price-lists-page',
  imports: [
    MatInputModule,
    HasPermissionDirective,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Price lists hold the selling price of each variant. Prices are set per variant from its detail page."
      i18n-subtitle="@@priceLists.subtitle"
    >
      <button
        *appHasPermission="'price-lists.manage'"
        mat-flat-button
        type="button"
        (click)="openCreate()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@priceLists.create">New price list</span>
      </button>
    </app-page-header>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (lists().length === 0) {
      <app-state-panel icon="sell" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="lists()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@priceLists.name">Price list</th>
            <td mat-cell *matCellDef="let list">{{ list.name }}</td>
          </ng-container>
          <ng-container matColumnDef="currency">
            <th mat-header-cell *matHeaderCellDef i18n="@@priceLists.currency">Currency</th>
            <td mat-cell *matCellDef="let list">{{ list.currencyCode }}</td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef i18n="@@priceLists.type">Type</th>
            <td mat-cell *matCellDef="let list">
              <app-status-chip [label]="typeLabel(list.type)" tone="neutral" />
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let list">
              <app-status-chip
                [label]="list.isActive ? activeLabel : inactiveLabel"
                [tone]="list.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              @if (editing() === row.id) {
                <input matInput #name [value]="row.name" maxlength="150" aria-label="Price list name" />
                <button mat-button type="button" (click)="rename(row, name.value)">Save</button>
                <button mat-button type="button" (click)="editing.set(null)">Cancel</button>
              } @else {
                <button *appHasPermission="'price-lists.manage'" mat-button type="button" (click)="editing.set(row.id)">Rename</button>
                @if (row.isActive) {
                  <button *appHasPermission="'price-lists.manage'" mat-button type="button" (click)="deactivate(row)">Deactivate</button>
                }
              }
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
export class PriceListsPage {
  private readonly api = inject(PriceListsApiService);
  private readonly confirm = inject(ConfirmService);
  readonly editing = signal<string | null>(null);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@priceLists.heading:Price lists`;
  readonly errorTitle = $localize`:@@priceLists.loadFailed:We could not load price lists`;
  readonly emptyTitle = $localize`:@@priceLists.empty.title:No price lists yet`;
  readonly emptyMessage = $localize`:@@priceLists.empty.message:Create a price list such as Retail or Wholesale, then price your variants.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly columns = ['name', 'currency', 'type', 'status', 'actions'];

  readonly lists = signal<PriceList[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  typeLabel(type: PriceList['type']): string {
    return type === 'Retail'
      ? $localize`:@@priceLists.type.retail:Retail`
      : $localize`:@@priceLists.type.wholesale:Wholesale`;
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (lists) => {
        this.lists.set(lists);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@priceLists.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  openCreate(): void {
    this.dialog
      .open(PriceListDialogComponent, { width: '32rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@priceLists.created:Price list created.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  rename(list: PriceList, name: string): void {
    this.api.rename(list.id, name.trim()).subscribe({
      next: () => { this.editing.set(null); this.load(); },
      error: error => this.snackBar.open(describeApiError(error, 'Could not rename the price list.'), undefined, { duration: 5000 }),
    });
  }

  deactivate(list: PriceList): void {
    this.confirm.confirm({
      title: 'Deactivate price list?',
      message: 'New transactions will stop using this list. Existing sales keep their recorded prices.',
      confirmLabel: 'Deactivate',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.api.deactivate(list.id).subscribe({
        next: () => this.load(),
        error: error => this.snackBar.open(describeApiError(error, 'Could not deactivate the price list.'), undefined, { duration: 5000 }),
      });
    });
  }
}
