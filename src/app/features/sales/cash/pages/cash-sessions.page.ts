import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import {
  Location,
  LocationsApiService,
} from '../../../inventory/locations/data-access/locations-api.service';
import { CashApiService, CashRegister, CashSession } from '../data-access/cash-api.service';
import {
  OpenSessionDialogComponent,
  OpenSessionDialogData,
} from '../ui/open-session-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-cash-sessions-page',
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
      subtitle="A session is one drawer, from opening cash to the counted close."
      i18n-subtitle="@@sessions.subtitle"
    >
      <button
        *appHasPermission="'cash-sessions.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog()"
      >
        <mat-icon aria-hidden="true">lock_open</mat-icon>
        <span i18n="@@sessions.open">Open session</span>
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
    } @else if (sessions().length === 0) {
      <app-state-panel icon="point_of_sale" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="sessions()" class="data-table">
          <ng-container matColumnDef="opened">
            <th mat-header-cell *matHeaderCellDef i18n="@@sessions.opened">Opened</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/app/sales/cash/sessions', row.id]">{{
                row.openedAt | date: 'medium'
              }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="register">
            <th mat-header-cell *matHeaderCellDef i18n="@@registers.title">Cash register</th>
            <td mat-cell *matCellDef="let row">{{ registerName(row.cashRegisterId) }}</td>
          </ng-container>
          <ng-container matColumnDef="expected">
            <th mat-header-cell *matHeaderCellDef i18n="@@sessions.expected">Expected cash</th>
            <td mat-cell *matCellDef="let row">{{ row.expectedCash | number: '1.2-2' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-chip
                [label]="row.status === 'Open' ? openLabel : closedLabel"
                [tone]="row.status === 'Open' ? 'neutral' : 'success'"
              />
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
export class CashSessionsPage {
  private readonly api = inject(CashApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly heading = $localize`:@@sessions.heading:Cash sessions`;
  readonly errorTitle = $localize`:@@sessions.loadFailed:We could not load cash sessions`;
  readonly emptyTitle = $localize`:@@sessions.empty.title:No cash sessions yet`;
  readonly emptyMessage = $localize`:@@sessions.empty.message:Open a session on a register to start taking cash.`;
  readonly openLabel = $localize`:@@sessions.status.open:Open`;
  readonly closedLabel = $localize`:@@sessions.status.closed:Closed`;
  readonly columns = ['opened', 'register', 'expected', 'status'];

  readonly sessions = signal<CashSession[]>([]);
  readonly registers = signal<CashRegister[]>([]);
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
      sessions: this.api.sessions(this.locationId(), { page: this.page(), pageSize }),
      registers: this.api.registers(null),
      locations: this.locationsApi.list(),
    }).subscribe({
      next: ({ sessions, registers, locations }) => {
        this.sessions.set(sessions);
        this.registers.set(registers);
        this.locations.set(locations);
        this.hasNext.set(sessions.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@sessions.loadFailedHint:Try again in a moment.`),
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

  openDialog(): void {
    const data: OpenSessionDialogData = {
      registers: this.registers().filter((register) => register.isActive),
    };
    this.dialog
      .open<OpenSessionDialogComponent, OpenSessionDialogData, { id: string }>(
        OpenSessionDialogComponent,
        {
          data,
          width: '30rem',
          autoFocus: 'dialog',
        },
      )
      .afterClosed()
      .subscribe((session) => {
        if (session) {
          void this.router.navigate(['/app/sales/cash/sessions', session.id]);
        }
      });
  }

  registerName(id: string): string {
    const register = this.registers().find((item) => item.id === id);
    return register ? `${register.name} (${register.code})` : id;
  }
}
