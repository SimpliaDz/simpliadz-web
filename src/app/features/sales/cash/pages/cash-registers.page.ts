import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import {
  Location,
  LocationsApiService,
} from '../../../inventory/locations/data-access/locations-api.service';
import { CashApiService, CashRegister } from '../data-access/cash-api.service';
import { RegisterDialogComponent, RegisterDialogData } from '../ui/register-dialog.component';

@Component({
  selector: 'app-cash-registers-page',
  imports: [
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Each till at a location. A cash session is opened on a register before taking cash."
      i18n-subtitle="@@registers.subtitle"
    >
      <button
        *appHasPermission="'cash-registers.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@registers.create">New register</span>
      </button>
    </app-page-header>

    <div class="toolbar">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@stock.field.location">Location</mat-label>
        <mat-select [(ngModel)]="locationId" (selectionChange)="load()">
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
    } @else if (registers().length === 0) {
      <app-state-panel icon="point_of_sale" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="registers()" class="data-table">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef i18n="@@registers.field.code">Code</th>
            <td mat-cell *matCellDef="let row">{{ row.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@registers.field.name">Name</th>
            <td mat-cell *matCellDef="let row">{{ row.name }}</td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.field.location">Location</th>
            <td mat-cell *matCellDef="let row">{{ locationName(row.locationId) }}</td>
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
                *appHasPermission="'cash-registers.manage'"
                mat-icon-button
                type="button"
                (click)="openDialog(row)"
                [attr.aria-label]="editLabel + ' ' + row.name"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              @if (row.isActive) {
                <button
                  *appHasPermission="'cash-registers.manage'"
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
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashRegistersPage {
  private readonly api = inject(CashApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@registers.heading:Cash registers`;
  readonly errorTitle = $localize`:@@registers.loadFailed:We could not load cash registers`;
  readonly emptyTitle = $localize`:@@registers.empty.title:No cash registers`;
  readonly emptyMessage = $localize`:@@registers.empty.message:Add a register at a location to start taking cash there.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;
  readonly columns = ['code', 'name', 'location', 'status', 'actions'];

  readonly registers = signal<CashRegister[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  locationId: string | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      registers: this.api.registers(this.locationId),
      locations: this.locationsApi.list(),
    }).subscribe({
      next: ({ registers, locations }) => {
        this.registers.set(registers);
        this.locations.set(locations);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@registers.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  openDialog(register: CashRegister | null): void {
    const data: RegisterDialogData = { register, locations: this.locations() };
    this.dialog
      .open(RegisterDialogComponent, { data, width: '32rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@registers.saved:Register saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  deactivate(register: CashRegister): void {
    this.confirm
      .confirm({
        title: $localize`:@@registers.deactivate.title:Deactivate register?`,
        message: $localize`:@@registers.deactivate.message:A register with an open session cannot be deactivated. Deactivated registers cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivateRegister(register.id).subscribe({
          next: () => {
            this.snackBar.open(
              $localize`:@@registers.deactivated:Register deactivated.`,
              undefined,
              { duration: 3000 },
            );
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@registers.deactivateFailed:The register could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }
}
