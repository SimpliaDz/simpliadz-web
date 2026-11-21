import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import {
  StatusChipComponent,
  StatusTone,
} from '../../../../shared/ui/status-chip/status-chip.component';
import { Location, LocationsApiService } from '../../locations/data-access/locations-api.service';
import {
  TransfersApiService,
  StockTransfer,
  TransferStatus,
} from '../data-access/transfers-api.service';
import { TransferDialogComponent, TransferDialogData } from '../ui/transfer-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-transfers-page',
  imports: [
    DatePipe,
    HasPermissionDirective,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
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
      subtitle="Move stock between locations. A transfer is a draft until it is completed."
      i18n-subtitle="@@transfers.subtitle"
    >
      <button
        *appHasPermission="'stock.manage'"
        mat-flat-button
        type="button"
        (click)="openCreate()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@transfers.create">New transfer</span>
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
    } @else if (transfers().length === 0) {
      <app-state-panel icon="local_shipping" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="transfers()" class="data-table">
          <ng-container matColumnDef="number">
            <th mat-header-cell *matHeaderCellDef i18n="@@transfers.number">Number</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/app/inventory/transfers', row.id]">{{ row.transferNumber }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="route">
            <th mat-header-cell *matHeaderCellDef i18n="@@transfers.route">From → To</th>
            <td mat-cell *matCellDef="let row">
              {{ locationName(row.sourceLocationId) }} →
              {{ locationName(row.destinationLocationId) }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-chip [label]="statusLabel(row.status)" [tone]="tone(row.status)" />
            </td>
          </ng-container>
          <ng-container matColumnDef="lines">
            <th mat-header-cell *matHeaderCellDef i18n="@@transfers.lines">Lines</th>
            <td mat-cell *matCellDef="let row">{{ row.lines.length }}</td>
          </ng-container>
          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef i18n="@@transfers.created">Created</th>
            <td mat-cell *matCellDef="let row">{{ row.createdAt | date: 'mediumDate' }}</td>
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
export class TransfersPage {
  private readonly api = inject(TransfersApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);

  readonly heading = $localize`:@@transfers.heading:Stock transfers`;
  readonly errorTitle = $localize`:@@transfers.loadFailed:We could not load transfers`;
  readonly emptyTitle = $localize`:@@transfers.empty.title:No transfers yet`;
  readonly emptyMessage = $localize`:@@transfers.empty.message:Create a transfer to move stock from one location to another.`;
  readonly columns = ['number', 'route', 'status', 'lines', 'created'];

  readonly canManage = computed(() => this.session.hasPermission('stock.manage'));
  readonly transfers = signal<StockTransfer[]>([]);
  readonly locations = signal<Location[]>([]);
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
    forkJoin({
      transfers: this.api.list({ page: this.page(), pageSize }),
      locations: this.locationsApi.list(),
    }).subscribe({
      next: ({ transfers, locations }) => {
        this.transfers.set(transfers);
        this.locations.set(locations);
        this.hasNext.set(transfers.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@transfers.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  openCreate(): void {
    const data: TransferDialogData = { locations: this.locations() };
    this.dialog
      .open<TransferDialogComponent, TransferDialogData, string>(TransferDialogComponent, {
        data,
        width: '30rem',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((id) => {
        if (id) {
          void this.router.navigate(['/app/inventory/transfers', id]);
        }
      });
  }

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }

  statusLabel(status: TransferStatus): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@transfers.status.draft:Draft`;
      case 'Completed':
        return $localize`:@@transfers.status.completed:Completed`;
      case 'Cancelled':
        return $localize`:@@transfers.status.cancelled:Cancelled`;
    }
  }

  tone(status: TransferStatus): StatusTone {
    return status === 'Completed' ? 'success' : status === 'Cancelled' ? 'warning' : 'neutral';
  }
}
