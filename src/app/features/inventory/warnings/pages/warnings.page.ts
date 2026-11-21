import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { numberOrNull } from '../../../../shared/forms/form-values';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Location, LocationsApiService } from '../../locations/data-access/locations-api.service';
import {
  StockWarning,
  WarningKind,
  WarningSettings,
  WarningsApiService,
} from '../data-access/warnings-api.service';

const pageSize = 50;

@Component({
  selector: 'app-warnings-page',
  imports: [
    DatePipe,
    HasPermissionDirective,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    ReactiveFormsModule,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Warnings flag low stock and stock that has sat too long. Warnings clear themselves when the problem is fixed."
      i18n-subtitle="@@warnings.subtitle"
    />

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else {
      <mat-card appearance="outlined" class="settings-card">
        <mat-card-header>
          <mat-card-title i18n="@@warnings.settings">Scan settings</mat-card-title>
          <mat-card-subtitle>{{ scheduleNote() }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="settingsForm" (ngSubmit)="saveSettings()" novalidate>
            <div class="form-grid">
              <div class="full-row toggles">
                <mat-slide-toggle formControlName="enabled" i18n="@@warnings.enabled"
                  >Run the scan on a schedule</mat-slide-toggle
                >
                <mat-slide-toggle formControlName="lowStockEnabled" i18n="@@warnings.lowStock"
                  >Low stock warnings</mat-slide-toggle
                >
                <mat-slide-toggle formControlName="ageingEnabled" i18n="@@warnings.ageing"
                  >Ageing stock warnings</mat-slide-toggle
                >
              </div>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@warnings.interval">Scan every (minutes)</mat-label>
                <input
                  matInput
                  type="number"
                  step="1"
                  min="5"
                  max="1440"
                  formControlName="intervalMinutes"
                />
                @if (settingsForm.controls.intervalMinutes.invalid) {
                  <mat-error i18n="@@warnings.intervalRange"
                    >Use between 5 and 1440 minutes.</mat-error
                  >
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@warnings.ageDays">Ageing threshold (days)</mat-label>
                <input
                  matInput
                  type="number"
                  step="1"
                  min="1"
                  max="3650"
                  formControlName="ageThresholdDays"
                />
                @if (settingsForm.controls.ageThresholdDays.invalid) {
                  <mat-error i18n="@@warnings.ageRange">Use between 1 and 3650 days.</mat-error>
                }
              </mat-form-field>
            </div>
            @if (settingsError(); as message) {
              <p class="form-error" role="alert">{{ message }}</p>
            }
            <div class="form-actions">
              <button
                *appHasPermission="'inventory-warnings.manage'"
                mat-stroked-button
                type="button"
                [disabled]="busy()"
                (click)="runNow()"
              >
                <span i18n="@@warnings.runNow">Run scan now</span>
              </button>
              <button
                *appHasPermission="'inventory-warnings.manage'"
                mat-flat-button
                type="submit"
                [disabled]="busy()"
              >
                <span i18n="@@common.save">Save</span>
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <div class="toolbar">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@stock.field.location">Location</mat-label>
          <mat-select
            [value]="locationId()"
            (selectionChange)="setFilter('location', $event.value)"
          >
            <mat-option [value]="null" i18n="@@common.all">All</mat-option>
            @for (location of locations(); track location.id) {
              <mat-option [value]="location.id">{{ location.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@warnings.kind">Type</mat-label>
          <mat-select [value]="kind()" (selectionChange)="setFilter('kind', $event.value)">
            <mat-option [value]="null" i18n="@@common.all">All</mat-option>
            <mat-option value="LowStock" i18n="@@warnings.kind.low">Low stock</mat-option>
            <mat-option value="Ageing" i18n="@@warnings.kind.ageing">Ageing</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle
          [checked]="activeOnly()"
          (change)="setFilter('active', $event.checked)"
          i18n="@@warnings.activeOnly"
          >Active only</mat-slide-toggle
        >
      </div>

      @if (warnings().length === 0) {
        <app-state-panel icon="notifications_none" [title]="emptyTitle" [message]="emptyMessage" />
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="warnings()" class="data-table">
            <ng-container matColumnDef="kind">
              <th mat-header-cell *matHeaderCellDef i18n="@@warnings.kind">Type</th>
              <td mat-cell *matCellDef="let row">
                <app-status-chip [label]="kindLabel(row.kind)" tone="warning" />
              </td>
            </ng-container>
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
              <td mat-cell *matCellDef="let row">{{ row.productName }} · {{ row.sku }}</td>
            </ng-container>
            <ng-container matColumnDef="location">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.field.location">Location</th>
              <td mat-cell *matCellDef="let row">{{ row.locationName }}</td>
            </ng-container>
            <ng-container matColumnDef="onHand">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.onHand">On hand</th>
              <td mat-cell *matCellDef="let row">{{ row.quantityOnHand }}</td>
            </ng-container>
            <ng-container matColumnDef="since">
              <th mat-header-cell *matHeaderCellDef i18n="@@warnings.since">First seen</th>
              <td mat-cell *matCellDef="let row">{{ row.firstDetectedAt | date: 'medium' }}</td>
            </ng-container>
            <ng-container matColumnDef="state">
              <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-chip
                  [label]="row.isActive ? openLabel : resolvedLabel"
                  [tone]="row.isActive ? 'warning' : 'success'"
                />
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <app-pager [page]="page()" [hasNext]="hasNext()" (pageChange)="goTo($event)" />
      }
    }
  `,
  styles: `
    .settings-card {
      margin-block-end: 1.5rem;
    }
    .toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarningsPage {
  private readonly api = inject(WarningsApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly heading = $localize`:@@warnings.heading:Inventory warnings`;
  readonly errorTitle = $localize`:@@warnings.loadFailed:We could not load warnings`;
  readonly emptyTitle = $localize`:@@warnings.empty.title:No warnings`;
  readonly emptyMessage = $localize`:@@warnings.empty.message:Nothing needs attention with the current filters.`;
  readonly openLabel = $localize`:@@warnings.open:Open`;
  readonly resolvedLabel = $localize`:@@warnings.resolved:Resolved`;
  readonly columns = ['kind', 'product', 'location', 'onHand', 'since', 'state'];

  readonly locations = signal<Location[]>([]);
  readonly warnings = signal<StockWarning[]>([]);
  readonly locationId = signal<string | null>(null);
  readonly kind = signal<WarningKind | null>(null);
  readonly activeOnly = signal(true);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly settingsError = signal<string | null>(null);
  readonly lastRun = signal<string | null>(null);
  readonly canManage = computed(() => this.session.hasPermission('inventory-warnings.manage'));

  readonly scheduleNote = signal('');

  readonly settingsForm = this.formBuilder.group({
    enabled: [false],
    lowStockEnabled: [true],
    ageingEnabled: [true],
    intervalMinutes: [60, [Validators.required, Validators.min(5), Validators.max(1440)]],
    ageThresholdDays: [30, [Validators.required, Validators.min(1), Validators.max(3650)]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      settings: this.api.settings(),
      locations: this.locationsApi.list(),
      warnings: this.api.list({
        locationId: this.locationId(),
        kind: this.kind(),
        activeOnly: this.activeOnly(),
        page: this.page(),
        pageSize,
      }),
    }).subscribe({
      next: ({ settings, locations, warnings }) => {
        this.applySettings(settings);
        this.locations.set(locations);
        this.warnings.set(warnings);
        this.hasNext.set(warnings.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@warnings.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  setFilter(kind: 'location' | 'kind' | 'active', value: string | boolean | null): void {
    if (kind === 'location') {
      this.locationId.set(value as string | null);
    } else if (kind === 'kind') {
      this.kind.set(value as WarningKind | null);
    } else {
      this.activeOnly.set(value as boolean);
    }
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    const value = this.settingsForm.getRawValue();
    const interval = numberOrNull(value.intervalMinutes);
    const age = numberOrNull(value.ageThresholdDays);
    this.busy.set(true);
    this.settingsError.set(null);
    this.api
      .saveSettings({
        enabled: value.enabled,
        lowStockEnabled: value.lowStockEnabled,
        ageingEnabled: value.ageingEnabled,
        intervalMinutes: interval ?? 60,
        ageThresholdDays: age ?? 30,
      })
      .subscribe({
        next: (settings) => {
          this.busy.set(false);
          this.applySettings(settings);
          this.snackBar.open($localize`:@@warnings.saved:Scan settings saved.`, undefined, {
            duration: 3000,
          });
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.settingsError.set(
            describeApiError(
              error,
              $localize`:@@warnings.saveFailed:The settings could not be saved.`,
            ),
          );
        },
      });
  }

  runNow(): void {
    this.busy.set(true);
    this.settingsError.set(null);
    this.api.runNow().subscribe({
      next: () => {
        this.busy.set(false);
        this.snackBar.open($localize`:@@warnings.ran:Scan finished.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.settingsError.set(
          describeApiError(error, $localize`:@@warnings.runFailed:The scan could not run.`),
        );
      },
    });
  }

  kindLabel(kind: WarningKind): string {
    return kind === 'LowStock'
      ? $localize`:@@warnings.kind.low:Low stock`
      : $localize`:@@warnings.kind.ageing:Ageing`;
  }

  private applySettings(settings: WarningSettings): void {
    this.settingsForm.reset({
      enabled: settings.enabled,
      lowStockEnabled: settings.lowStockEnabled,
      ageingEnabled: settings.ageingEnabled,
      intervalMinutes: settings.intervalMinutes,
      ageThresholdDays: settings.ageThresholdDays,
    });
    this.lastRun.set(settings.lastRunAt);
    this.scheduleNote.set(
      settings.enabled
        ? $localize`:@@warnings.scheduleOn:Scheduled scans are on.`
        : $localize`:@@warnings.scheduleOff:Scheduled scans are off. You can still run a scan manually.`,
    );
  }
}
