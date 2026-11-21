import { DatePipe } from '@angular/common';
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
import { CountStatus, CountsApiService, InventoryCount } from '../data-access/counts-api.service';
import { CountDialogComponent, CountDialogData } from '../ui/count-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-counts-page',
  imports: [
    DatePipe,
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
      subtitle="A physical count compares what the system expects with what is on the shelf."
      i18n-subtitle="@@counts.subtitle"
    >
      <button
        *appHasPermission="'stock.manage'"
        mat-flat-button
        type="button"
        (click)="openStart()"
      >
        <mat-icon aria-hidden="true">playlist_add_check</mat-icon>
        <span i18n="@@counts.start">Start count</span>
      </button>
    </app-page-header>

    <div class="toolbar">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@stock.field.location">Location</mat-label>
        <mat-select [value]="locationId()" (selectionChange)="filterBy($event.value)">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
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
    } @else if (counts().length === 0) {
      <app-state-panel icon="checklist" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="counts()" class="data-table">
          <ng-container matColumnDef="started">
            <th mat-header-cell *matHeaderCellDef i18n="@@counts.started">Started</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/app/inventory/counts', row.id]">{{
                row.startedAt | date: 'medium'
              }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.field.location">Location</th>
            <td mat-cell *matCellDef="let row">{{ locationName(row.locationId) }}</td>
          </ng-container>
          <ng-container matColumnDef="lines">
            <th mat-header-cell *matHeaderCellDef i18n="@@counts.lines">Lines</th>
            <td mat-cell *matCellDef="let row">{{ row.lines.length }}</td>
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
export class CountsPage {
  private readonly api = inject(CountsApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);

  readonly heading = $localize`:@@counts.heading:Stock counts`;
  readonly errorTitle = $localize`:@@counts.loadFailed:We could not load stock counts`;
  readonly emptyTitle = $localize`:@@counts.empty.title:No counts yet`;
  readonly emptyMessage = $localize`:@@counts.empty.message:Start a count at a location to check the shelves against the system.`;
  readonly columns = ['started', 'location', 'lines', 'status'];

  readonly canManage = computed(() => this.session.hasPermission('stock.manage'));
  readonly counts = signal<InventoryCount[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly locationId = signal<string | null>(null);
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
      counts: this.api.list(this.locationId(), { page: this.page(), pageSize }),
      locations: this.locationsApi.list(),
    }).subscribe({
      next: ({ counts, locations }) => {
        this.counts.set(counts);
        this.locations.set(locations);
        this.hasNext.set(counts.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@counts.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  filterBy(id: string | null): void {
    this.locationId.set(id);
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  openStart(): void {
    const data: CountDialogData = { locations: this.locations() };
    this.dialog
      .open<CountDialogComponent, CountDialogData, string>(CountDialogComponent, {
        data,
        width: '30rem',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((id) => {
        if (id) {
          void this.router.navigate(['/app/inventory/counts', id]);
        }
      });
  }

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }

  statusLabel(status: CountStatus): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@counts.status.draft:In progress`;
      case 'Completed':
        return $localize`:@@counts.status.completed:Completed`;
      case 'Cancelled':
        return $localize`:@@counts.status.cancelled:Cancelled`;
    }
  }

  tone(status: CountStatus): StatusTone {
    return status === 'Completed' ? 'success' : status === 'Cancelled' ? 'warning' : 'neutral';
  }
}
