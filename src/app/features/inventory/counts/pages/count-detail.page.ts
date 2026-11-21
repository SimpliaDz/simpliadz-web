import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { numberOrNull } from '../../../../shared/forms/form-values';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Location, LocationsApiService } from '../../locations/data-access/locations-api.service';
import {
  VariantCatalogueService,
  VariantOption,
} from '../../stock/data-access/variant-catalogue.service';
import {
  CountsApiService,
  InventoryCount,
  InventoryCountLine,
} from '../data-access/counts-api.service';

@Component({
  selector: 'app-count-detail-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (count(); as current) {
      <app-page-header
        [title]="heading"
        [backLink]="backLink"
        [subtitle]="locationName(current.locationId)"
      >
        <app-status-chip
          [label]="statusLabel(current.status)"
          [tone]="current.status === 'Completed' ? 'success' : 'neutral'"
        />
        @if (canManage() && current.status === 'Draft') {
          <button
            mat-stroked-button
            type="button"
            [disabled]="busy()"
            (click)="cancel(current)"
            i18n="@@counts.cancel"
          >
            Cancel count
          </button>
          <button
            mat-flat-button
            type="button"
            [disabled]="busy() || !allCounted(current)"
            (click)="complete(current)"
            i18n="@@counts.complete"
          >
            Complete count
          </button>
        }
      </app-page-header>

      <p class="form-hint" i18n="@@counts.auditNotice">
        Completing a count writes the differences as adjustments and is recorded in the audit trail.
      </p>

      @if (actionError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      @if (current.lines.length === 0) {
        <app-state-panel icon="checklist" [title]="noLinesTitle" [message]="noLinesMessage" />
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="current.lines" class="data-table">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
              <td mat-cell *matCellDef="let line">{{ variantLabel(line.productVariantId) }}</td>
            </ng-container>
            <ng-container matColumnDef="expected">
              <th mat-header-cell *matHeaderCellDef i18n="@@counts.expected">Expected</th>
              <td mat-cell *matCellDef="let line">{{ line.expectedQuantity }}</td>
            </ng-container>
            <ng-container matColumnDef="counted">
              <th mat-header-cell *matHeaderCellDef i18n="@@counts.counted">Counted</th>
              <td mat-cell *matCellDef="let line">
                @if (canManage() && current.status === 'Draft') {
                  <mat-form-field
                    appearance="outline"
                    subscriptSizing="dynamic"
                    class="count-field"
                  >
                    <mat-label i18n="@@counts.counted">Counted</mat-label>
                    <input
                      matInput
                      type="number"
                      min="0"
                      step="1"
                      [value]="line.countedQuantity ?? ''"
                      (change)="setCounted(current, line, $any($event.target).value)"
                      [attr.aria-label]="
                        'Counted quantity for ' + variantLabel(line.productVariantId)
                      "
                    />
                  </mat-form-field>
                } @else {
                  {{ line.countedQuantity ?? '—' }}
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="difference">
              <th mat-header-cell *matHeaderCellDef i18n="@@counts.difference">Difference</th>
              <td mat-cell *matCellDef="let line">
                @if (line.difference === null) {
                  —
                } @else if (line.difference === 0) {
                  <app-status-chip [label]="matchLabel" tone="success" />
                } @else {
                  <app-status-chip
                    [label]="line.difference > 0 ? '+' + line.difference : '' + line.difference"
                    tone="warning"
                  />
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }

      @if (canManage() && current.status === 'Draft') {
        <h2 class="section-title" i18n="@@counts.addLine">Add a product to count</h2>
        <form class="form-surface" [formGroup]="addForm" (ngSubmit)="addLine(current)" novalidate>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@stock.field.variant">Product variant</mat-label>
              <mat-select formControlName="productVariantId">
                @for (variant of variants(); track variant.id) {
                  <mat-option [value]="variant.id" [disabled]="!variant.isActive">{{
                    variant.label
                  }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button
              mat-stroked-button
              type="submit"
              [disabled]="busy()"
              i18n="@@counts.addLine.action"
            >
              Add line
            </button>
          </div>
        </form>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountDetailPage {
  private readonly api = inject(CountsApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly catalogue = inject(VariantCatalogueService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly countId = this.activatedRoute.snapshot.paramMap.get('id') ?? '';

  readonly heading = $localize`:@@counts.detail.heading:Stock count`;
  readonly errorTitle = $localize`:@@counts.detail.loadFailed:We could not load this count`;
  readonly noLinesTitle = $localize`:@@counts.noLines.title:No products yet`;
  readonly noLinesMessage = $localize`:@@counts.noLines.message:Add the products you are counting, then enter the quantities you find.`;
  readonly matchLabel = $localize`:@@counts.match:Matches`;
  readonly backLink = {
    label: $localize`:@@counts.backToList:All counts`,
    path: '/app/inventory/counts',
  };

  readonly canManage = computed(() => this.session.hasPermission('stock.manage'));
  readonly count = signal<InventoryCount | null>(null);
  readonly locations = signal<Location[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly columns = ['product', 'expected', 'counted', 'difference'];
  private variantNames = new Map<string, string>();

  readonly addForm = this.formBuilder.group({
    productVariantId: ['', [Validators.required]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      count: this.api.get(this.countId),
      locations: this.locationsApi.list(),
      variants: this.catalogue.options(),
    }).subscribe({
      next: ({ count, locations, variants }) => {
        this.count.set(count);
        this.locations.set(locations);
        this.variants.set(variants);
        this.variantNames = new Map(variants.map((variant) => [variant.id, variant.label]));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@counts.detail.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  allCounted(current: InventoryCount): boolean {
    return current.lines.length > 0 && current.lines.every((line) => line.countedQuantity !== null);
  }

  addLine(current: InventoryCount): void {
    const value = this.addForm.getRawValue();
    if (!value.productVariantId) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api.addLine(current.id, value.productVariantId).subscribe({
      next: () => {
        this.busy.set(false);
        this.addForm.reset({ productVariantId: '' });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(error, $localize`:@@counts.lineFailed:The product could not be added.`),
        );
      },
    });
  }

  setCounted(current: InventoryCount, line: InventoryCountLine, raw: string): void {
    const quantity = numberOrNull(raw);
    if (quantity === null || quantity < 0 || !Number.isInteger(quantity)) {
      this.actionError.set(
        $localize`:@@counts.quantityInvalid:Enter a whole number of zero or more.`,
      );
      return;
    }
    this.actionError.set(null);
    this.api.setCounted(current.id, line.productVariantId, quantity).subscribe({
      next: (updated) => this.count.set(updated),
      error: (error: unknown) =>
        this.actionError.set(
          describeApiError(error, $localize`:@@counts.countFailed:The count could not be saved.`),
        ),
    });
  }

  complete(current: InventoryCount): void {
    this.confirm
      .confirm({
        title: $localize`:@@counts.complete.title:Complete this count?`,
        message: $localize`:@@counts.complete.message:Each difference becomes a stock adjustment. If stock moved at this location since the count started, the count is refused and must be started again.`,
        confirmLabel: $localize`:@@counts.complete:Complete count`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy.set(true);
        this.api.complete(current.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.snackBar.open($localize`:@@counts.completed:Count completed.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@counts.completeFailed:The count could not be completed.`,
              ),
            );
          },
        });
      });
  }

  cancel(current: InventoryCount): void {
    this.confirm
      .confirm({
        title: $localize`:@@counts.cancel.title:Cancel this count?`,
        message: $localize`:@@counts.cancel.message:The count is closed without changing any stock.`,
        confirmLabel: $localize`:@@counts.cancel:Cancel count`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy.set(true);
        this.api.cancel(current.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.load();
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@counts.cancelFailed:The count could not be cancelled.`,
              ),
            );
          },
        });
      });
  }

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }

  variantLabel(id: string): string {
    return this.variantNames.get(id) ?? id;
  }

  statusLabel(status: InventoryCount['status']): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@counts.status.draft:In progress`;
      case 'Completed':
        return $localize`:@@counts.status.completed:Completed`;
      case 'Cancelled':
        return $localize`:@@counts.status.cancelled:Cancelled`;
    }
  }
}
