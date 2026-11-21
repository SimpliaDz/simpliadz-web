import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Location, LocationsApiService } from '../../locations/data-access/locations-api.service';
import { InventoryPolicy, StockApiService } from '../data-access/stock-api.service';
import { VariantCatalogueService, VariantOption } from '../data-access/variant-catalogue.service';
import { PolicyDialogComponent, PolicyDialogData } from '../ui/policy-dialog.component';

type Flag = 'all' | 'yes' | 'no';

const pageSize = 50;

@Component({
  selector: 'app-reorder-policies-page',
  imports: [
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="A reorder point tells you when a variant at a location needs restocking."
      i18n-subtitle="@@policies.subtitle"
    >
      <button
        *appHasPermission="'stock.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@policies.create">Set reorder policy</span>
      </button>
    </app-page-header>

    <div class="toolbar">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@stock.field.location">Location</mat-label>
        <mat-select [value]="locationId()" (selectionChange)="setFilter('location', $event.value)">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (location of locations(); track location.id) {
            <mat-option [value]="location.id">{{ location.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@policies.filter.below">Below reorder point</mat-label>
        <mat-select [value]="below()" (selectionChange)="setFilter('below', $event.value)">
          <mat-option value="all" i18n="@@common.all">All</mat-option>
          <mat-option value="yes" i18n="@@common.yes">Yes</mat-option>
          <mat-option value="no" i18n="@@common.no">No</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@policies.filter.out">Out of stock</mat-label>
        <mat-select [value]="outFlag()" (selectionChange)="setFilter('out', $event.value)">
          <mat-option value="all" i18n="@@common.all">All</mat-option>
          <mat-option value="yes" i18n="@@common.yes">Yes</mat-option>
          <mat-option value="no" i18n="@@common.no">No</mat-option>
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
    } @else if (policies().length === 0) {
      <app-state-panel icon="rule" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="policies()" class="data-table">
          <ng-container matColumnDef="product">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
            <td mat-cell *matCellDef="let row">{{ variantLabel(row.productVariantId) }}</td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.field.location">Location</th>
            <td mat-cell *matCellDef="let row">{{ locationName(row.locationId) }}</td>
          </ng-container>
          <ng-container matColumnDef="onHand">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.onHand">On hand</th>
            <td mat-cell *matCellDef="let row">{{ row.quantityOnHand }}</td>
          </ng-container>
          <ng-container matColumnDef="reorder">
            <th mat-header-cell *matHeaderCellDef i18n="@@policies.reorderPoint">Reorder point</th>
            <td mat-cell *matCellDef="let row">{{ row.reorderPoint }}</td>
          </ng-container>
          <ng-container matColumnDef="target">
            <th mat-header-cell *matHeaderCellDef i18n="@@policies.targetLevel">Target</th>
            <td mat-cell *matCellDef="let row">{{ row.targetStockLevel ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="flags">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              @if (row.isOutOfStock) {
                <app-status-chip [label]="outLabel" tone="warning" />
              } @else if (row.isBelowReorderPoint) {
                <app-status-chip [label]="lowLabel" tone="warning" />
              } @else {
                <app-status-chip [label]="okLabel" tone="success" />
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button
                *appHasPermission="'stock.manage'"
                mat-icon-button
                type="button"
                (click)="openDialog(row)"
                [attr.aria-label]="editLabel + ' ' + variantLabel(row.productVariantId)"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
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
export class ReorderPoliciesPage {
  private readonly stock = inject(StockApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly catalogue = inject(VariantCatalogueService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);

  readonly heading = $localize`:@@policies.heading:Reorder policies`;
  readonly errorTitle = $localize`:@@policies.loadFailed:We could not load reorder policies`;
  readonly emptyTitle = $localize`:@@policies.empty.title:No reorder policies`;
  readonly emptyMessage = $localize`:@@policies.empty.message:Set a reorder point for a variant at a location to get warned when stock runs low.`;
  readonly outLabel = $localize`:@@stock.out:Out of stock`;
  readonly lowLabel = $localize`:@@policies.low:Below reorder point`;
  readonly okLabel = $localize`:@@policies.ok:OK`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly columns = ['product', 'location', 'onHand', 'reorder', 'target', 'flags', 'actions'];

  readonly variants = signal<VariantOption[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly locationId = signal<string | null>(null);
  readonly below = signal<Flag>('all');
  readonly outFlag = signal<Flag>('all');
  readonly policies = signal<InventoryPolicy[]>([]);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly canManage = computed(() => this.session.hasPermission('stock.manage'));
  private variantNames = new Map<string, string>();
  private locationNames = new Map<string, string>();

  constructor() {
    forkJoin({ variants: this.catalogue.options(), locations: this.locationsApi.list() }).subscribe(
      {
        next: ({ variants, locations }) => {
          this.variants.set(variants);
          this.locations.set(locations);
          this.variantNames = new Map(variants.map((variant) => [variant.id, variant.label]));
          this.locationNames = new Map(locations.map((location) => [location.id, location.name]));
          this.load();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            describeApiError(error, $localize`:@@policies.loadFailedHint:Try again in a moment.`),
          );
        },
      },
    );
  }

  setFilter(kind: 'location' | 'below' | 'out', value: string | null): void {
    if (kind === 'location') {
      this.locationId.set(value);
    } else if (kind === 'below') {
      this.below.set(value as Flag);
    } else {
      this.outFlag.set(value as Flag);
    }
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
    this.stock
      .policies({
        locationId: this.locationId(),
        belowReorderPoint: this.flagValue(this.below()),
        outOfStock: this.flagValue(this.outFlag()),
        page: this.page(),
        pageSize,
      })
      .subscribe({
        next: (policies) => {
          this.policies.set(policies);
          this.hasNext.set(policies.length === pageSize);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            describeApiError(error, $localize`:@@policies.loadFailedHint:Try again in a moment.`),
          );
        },
      });
  }

  openDialog(policy: InventoryPolicy | null): void {
    const data: PolicyDialogData = {
      policy,
      variants: this.variants(),
      locations: this.locations(),
    };
    this.dialog
      .open(PolicyDialogComponent, { data, width: '30rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@policies.saved:Reorder policy saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  variantLabel(id: string): string {
    return this.variantNames.get(id) ?? id;
  }

  locationName(id: string): string {
    return this.locationNames.get(id) ?? id;
  }

  private flagValue(flag: Flag): boolean | null {
    return flag === 'all' ? null : flag === 'yes';
  }
}
