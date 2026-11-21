import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { Location, LocationsApiService } from '../../locations/data-access/locations-api.service';
import { StockApiService, StockMovement } from '../data-access/stock-api.service';
import { VariantCatalogueService, VariantOption } from '../data-access/variant-catalogue.service';

const pageSize = 50;

@Component({
  selector: 'app-stock-movements-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Every stock change is recorded here and never edited. Corrections are new movements."
      i18n-subtitle="@@movements.subtitle"
    />

    <div class="toolbar">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label i18n="@@stock.field.variant">Product variant</mat-label>
        <mat-select [value]="variantId()" (selectionChange)="filter('variant', $event.value)">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (variant of variants(); track variant.id) {
            <mat-option [value]="variant.id">{{ variant.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@stock.field.location">Location</mat-label>
        <mat-select [value]="locationId()" (selectionChange)="filter('location', $event.value)">
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
    } @else if (movements().length === 0) {
      <app-state-panel icon="swap_vert" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="movements()" class="data-table">
          <ng-container matColumnDef="when">
            <th mat-header-cell *matHeaderCellDef i18n="@@movements.when">When</th>
            <td mat-cell *matCellDef="let row">{{ row.occurredAt | date: 'medium' }}</td>
          </ng-container>
          <ng-container matColumnDef="product">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
            <td mat-cell *matCellDef="let row">{{ variantLabel(row.productVariantId) }}</td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef i18n="@@stock.field.location">Location</th>
            <td mat-cell *matCellDef="let row">{{ locationName(row.locationId) }}</td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef i18n="@@movements.type">Type</th>
            <td mat-cell *matCellDef="let row">{{ row.movementType }}</td>
          </ng-container>
          <ng-container matColumnDef="delta">
            <th mat-header-cell *matHeaderCellDef i18n="@@movements.change">Change</th>
            <td mat-cell *matCellDef="let row">
              {{ row.quantityDelta > 0 ? '+' : '' }}{{ row.quantityDelta }}
            </td>
          </ng-container>
          <ng-container matColumnDef="note">
            <th mat-header-cell *matHeaderCellDef i18n="@@movements.note">Reference and reason</th>
            <td mat-cell *matCellDef="let row" class="muted">{{ note(row) }}</td>
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
export class StockMovementsPage {
  private readonly stock = inject(StockApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly catalogue = inject(VariantCatalogueService);

  readonly heading = $localize`:@@movements.heading:Stock movements`;
  readonly errorTitle = $localize`:@@movements.loadFailed:We could not load movements`;
  readonly emptyTitle = $localize`:@@movements.empty.title:No movements`;
  readonly emptyMessage = $localize`:@@movements.empty.message:Nothing matches these filters yet.`;
  readonly columns = ['when', 'product', 'location', 'type', 'delta', 'note'];

  readonly variants = signal<VariantOption[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly variantId = signal<string | null>(null);
  readonly locationId = signal<string | null>(null);
  readonly movements = signal<StockMovement[]>([]);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

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
            describeApiError(error, $localize`:@@movements.loadFailedHint:Try again in a moment.`),
          );
        },
      },
    );
  }

  filter(kind: 'variant' | 'location', value: string | null): void {
    if (kind === 'variant') {
      this.variantId.set(value);
    } else {
      this.locationId.set(value);
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
      .movements({
        productVariantId: this.variantId(),
        locationId: this.locationId(),
        page: this.page(),
        pageSize,
      })
      .subscribe({
        next: (movements) => {
          this.movements.set(movements);
          this.hasNext.set(movements.length === pageSize);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            describeApiError(error, $localize`:@@movements.loadFailedHint:Try again in a moment.`),
          );
        },
      });
  }

  note(row: StockMovement): string {
    return [row.reference, row.reason].filter((part) => !!part).join(' · ') || '—';
  }

  variantLabel(id: string): string {
    return this.variantNames.get(id) ?? id;
  }

  locationName(id: string): string {
    return this.locationNames.get(id) ?? id;
  }
}
