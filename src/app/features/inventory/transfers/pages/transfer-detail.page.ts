import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
import { StockTransfer, TransfersApiService } from '../data-access/transfers-api.service';

@Component({
  selector: 'app-transfer-detail-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
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
    } @else if (transfer(); as current) {
      <app-page-header
        [title]="current.transferNumber"
        [backLink]="backLink"
        [subtitle]="route(current)"
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
            i18n="@@transfers.cancel"
          >
            Cancel transfer
          </button>
          <button
            mat-flat-button
            type="button"
            [disabled]="busy() || current.lines.length === 0"
            (click)="complete(current)"
            i18n="@@transfers.complete"
          >
            Complete transfer
          </button>
        }
      </app-page-header>

      @if (actionError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      <h2 class="section-title" i18n="@@transfers.lines">Lines</h2>
      @if (current.lines.length === 0) {
        <p class="muted" i18n="@@transfers.noLines">No lines yet. Add the products to move.</p>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="current.lines" class="data-table">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
              <td mat-cell *matCellDef="let line">{{ variantLabel(line.productVariantId) }}</td>
            </ng-container>
            <ng-container matColumnDef="quantity">
              <th mat-header-cell *matHeaderCellDef i18n="@@transfers.quantity">Quantity</th>
              <td mat-cell *matCellDef="let line">{{ line.quantity }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="lineColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: lineColumns"></tr>
          </table>
        </div>
      }

      @if (canManage() && current.status === 'Draft') {
        <h2 class="section-title" i18n="@@transfers.addLine">Add a line</h2>
        <form class="form-surface" [formGroup]="lineForm" (ngSubmit)="addLine(current)" novalidate>
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
            <mat-form-field appearance="outline">
              <mat-label i18n="@@transfers.quantity">Quantity</mat-label>
              <input matInput type="number" step="1" min="1" formControlName="quantity" />
              @if (lineForm.controls.quantity.hasError('min')) {
                <mat-error i18n="@@validation.positive">Enter at least 1.</mat-error>
              }
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button
              mat-stroked-button
              type="submit"
              [disabled]="busy()"
              i18n="@@transfers.addLine.action"
            >
              Add line
            </button>
          </div>
        </form>
      }

      <h2 class="section-title" i18n="@@transfers.details">Details</h2>
      <dl class="detail-list">
        <dt i18n="@@transfers.source">From</dt>
        <dd>{{ locationName(current.sourceLocationId) }}</dd>
        <dt i18n="@@transfers.destination">To</dt>
        <dd>{{ locationName(current.destinationLocationId) }}</dd>
        <dt i18n="@@transfers.created">Created</dt>
        <dd>{{ current.createdAt | date: 'medium' }}</dd>
        @if (current.completedAt) {
          <dt i18n="@@transfers.completedAt">Completed</dt>
          <dd>{{ current.completedAt | date: 'medium' }}</dd>
        }
      </dl>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferDetailPage {
  private readonly api = inject(TransfersApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly catalogue = inject(VariantCatalogueService);
  private readonly route_ = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly transferId = this.route_.snapshot.paramMap.get('id') ?? '';

  readonly errorTitle = $localize`:@@transfers.detail.loadFailed:We could not load this transfer`;
  readonly backLink = {
    label: $localize`:@@transfers.backToList:All transfers`,
    path: '/app/inventory/transfers',
  };
  readonly lineColumns = ['product', 'quantity'];

  readonly canManage = computed(() => this.session.hasPermission('stock.manage'));
  readonly transfer = signal<StockTransfer | null>(null);
  readonly locations = signal<Location[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  private variantNames = new Map<string, string>();

  readonly lineForm = this.formBuilder.group({
    productVariantId: ['', [Validators.required]],
    quantity: this.formBuilder.control<number | null>(1, [Validators.required, Validators.min(1)]),
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      transfer: this.api.get(this.transferId),
      locations: this.locationsApi.list(),
      variants: this.catalogue.options(),
    }).subscribe({
      next: ({ transfer, locations, variants }) => {
        this.transfer.set(transfer);
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
            $localize`:@@transfers.detail.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  addLine(current: StockTransfer): void {
    const value = this.lineForm.getRawValue();
    const quantity = numberOrNull(value.quantity);
    if (
      !value.productVariantId ||
      quantity === null ||
      quantity < 1 ||
      !Number.isInteger(quantity)
    ) {
      this.lineForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api.addLine(current.id, value.productVariantId, quantity).subscribe({
      next: () => {
        this.busy.set(false);
        this.lineForm.reset({ productVariantId: '', quantity: 1 });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(error, $localize`:@@transfers.lineFailed:The line could not be added.`),
        );
      },
    });
  }

  complete(current: StockTransfer): void {
    this.confirm
      .confirm({
        title: $localize`:@@transfers.complete.title:Complete this transfer?`,
        message: $localize`:@@transfers.complete.message:Stock moves from the source to the destination now. If any line is short, nothing moves and the transfer stays a draft.`,
        confirmLabel: $localize`:@@transfers.complete:Complete transfer`,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy.set(true);
        this.api.complete(current.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.snackBar.open($localize`:@@transfers.completed:Transfer completed.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@transfers.completeFailed:The transfer could not be completed.`,
              ),
            );
          },
        });
      });
  }

  cancel(current: StockTransfer): void {
    this.confirm
      .confirm({
        title: $localize`:@@transfers.cancel.title:Cancel this transfer?`,
        message: $localize`:@@transfers.cancel.message:A cancelled transfer cannot be reopened. No stock moves.`,
        confirmLabel: $localize`:@@transfers.cancel:Cancel transfer`,
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
                $localize`:@@transfers.cancelFailed:The transfer could not be cancelled.`,
              ),
            );
          },
        });
      });
  }

  route(current: StockTransfer): string {
    return `${this.locationName(current.sourceLocationId)} → ${this.locationName(current.destinationLocationId)}`;
  }

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }

  variantLabel(id: string): string {
    return this.variantNames.get(id) ?? id;
  }

  statusLabel(status: StockTransfer['status']): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@transfers.status.draft:Draft`;
      case 'Completed':
        return $localize`:@@transfers.status.completed:Completed`;
      case 'Cancelled':
        return $localize`:@@transfers.status.cancelled:Cancelled`;
    }
  }
}
