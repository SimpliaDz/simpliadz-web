import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Location, LocationsApiService } from '../data-access/locations-api.service';

@Component({
  selector: 'app-locations-page',
  imports: [
    HasPermissionDirective,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Stores sell stock; warehouses hold it. Stock is tracked per location."
      i18n-subtitle="@@locations.subtitle"
    >
      <a
        *appHasPermission="'locations.create'"
        mat-flat-button
        routerLink="/app/inventory/locations/new"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@locations.create">New location</span>
      </a>
    </app-page-header>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (locations().length === 0) {
      <app-state-panel icon="store" [title]="emptyTitle" [message]="emptyMessage">
        <a
          *appHasPermission="'locations.create'"
          mat-flat-button
          routerLink="/app/inventory/locations/new"
          i18n="@@locations.create"
          >New location</a
        >
      </app-state-panel>
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="locations()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let location">{{ location.name }}</td>
          </ng-container>
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef i18n="@@locations.code">Code</th>
            <td mat-cell *matCellDef="let location">{{ location.code ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef i18n="@@locations.type">Type</th>
            <td mat-cell *matCellDef="let location">
              <app-status-chip [label]="typeLabel(location.type)" tone="neutral" />
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let location">
              <app-status-chip
                [label]="location.isActive ? activeLabel : inactiveLabel"
                [tone]="location.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let location" class="actions-cell">
              <a
                *appHasPermission="'locations.edit'"
                mat-icon-button
                [routerLink]="['/app/inventory/locations', location.id, 'edit']"
                [attr.aria-label]="editLabel + ' ' + location.name"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </a>
              @if (location.isActive) {
                <button
                  *appHasPermission="'locations.edit'"
                  mat-icon-button
                  type="button"
                  (click)="deactivate(location)"
                  [attr.aria-label]="deactivateLabel + ' ' + location.name"
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
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationsPage {
  private readonly api = inject(LocationsApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@locations.heading:Locations`;
  readonly errorTitle = $localize`:@@locations.loadFailed:We could not load locations`;
  readonly emptyTitle = $localize`:@@locations.empty.title:No locations yet`;
  readonly emptyMessage = $localize`:@@locations.empty.message:Add the store or warehouse where stock is kept and sold.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;
  readonly columns = ['name', 'code', 'type', 'status', 'actions'];

  readonly locations = signal<Location[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  typeLabel(type: Location['type']): string {
    return type === 'Store'
      ? $localize`:@@locations.type.store:Store`
      : $localize`:@@locations.type.warehouse:Warehouse`;
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (locations) => {
        this.locations.set(locations);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@locations.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  deactivate(location: Location): void {
    this.confirm
      .confirm({
        title: $localize`:@@locations.deactivate.title:Deactivate location?`,
        message: $localize`:@@locations.deactivate.message:Stock history is kept. The location can no longer be used for new stock or sales. Locations cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivate(location.id).subscribe({
          next: () => {
            this.snackBar.open(
              $localize`:@@locations.deactivated:Location deactivated.`,
              undefined,
              { duration: 3000 },
            );
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@locations.deactivateFailed:The location could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }
}
