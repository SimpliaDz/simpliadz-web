import { DatePipe, DecimalPipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin, of } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { blankToNull, numberOrNull } from '../../../../shared/forms/form-values';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import {
  Location,
  LocationsApiService,
} from '../../../inventory/locations/data-access/locations-api.service';
import {
  VariantCatalogueService,
  VariantOption,
} from '../../../inventory/stock/data-access/variant-catalogue.service';
import { Supplier, SuppliersApiService } from '../../suppliers/data-access/suppliers-api.service';
import {
  GoodsReceipt,
  PurchaseOrder,
  PurchaseOrdersApiService,
  SupplierPaymentBalance,
} from '../data-access/purchase-orders-api.service';

@Component({
  selector: 'app-purchase-order-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
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
    } @else if (order(); as current) {
      <app-page-header
        [title]="current.purchaseOrderNumber"
        [backLink]="backLink"
        [subtitle]="supplierName()"
      >
        <app-status-chip
          [label]="statusLabel(current.status)"
          [tone]="current.status === 'Received' ? 'success' : 'neutral'"
        />
        @if (canManage() && (current.status === 'Draft' || current.status === 'Ordered')) {
          <button
            mat-stroked-button
            type="button"
            [disabled]="busy()"
            (click)="cancel(current)"
            i18n="@@orders.cancel"
          >
            Cancel order
          </button>
        }
        @if (canManage() && current.status === 'Draft') {
          <button
            mat-flat-button
            type="button"
            [disabled]="busy() || current.lines.length === 0"
            (click)="place(current)"
            i18n="@@orders.place"
          >
            Place order
          </button>
        }
      </app-page-header>

      @if (actionError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      <h2 class="section-title" i18n="@@orders.lines">Lines</h2>
      @if (current.lines.length === 0) {
        <p class="muted" i18n="@@orders.noLines">No lines yet. Add the products you are buying.</p>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="current.lines" class="data-table">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
              <td mat-cell *matCellDef="let line">{{ variantLabel(line.productVariantId) }}</td>
            </ng-container>
            <ng-container matColumnDef="ordered">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.ordered">Ordered</th>
              <td mat-cell *matCellDef="let line">{{ line.orderedQuantity }}</td>
            </ng-container>
            <ng-container matColumnDef="received">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.received">Received</th>
              <td mat-cell *matCellDef="let line">{{ line.receivedQuantity }}</td>
            </ng-container>
            <ng-container matColumnDef="cost">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.unitCost">Unit cost</th>
              <td mat-cell *matCellDef="let line">{{ line.unitCost | number: '1.2-4' }}</td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.lineTotal">Line total</th>
              <td mat-cell *matCellDef="let line">{{ line.lineTotal | number: '1.2-2' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="lineColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: lineColumns"></tr>
          </table>
        </div>
        <p class="total-line">
          <span i18n="@@orders.total">Total</span>:
          <strong>{{ current.total | number: '1.2-2' }}</strong>
        </p>
      }

      @if (canManage() && current.status === 'Draft') {
        <h2 class="section-title" i18n="@@orders.addLine">Add a line</h2>
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
              <mat-label i18n="@@orders.orderedQty">Quantity</mat-label>
              <input matInput type="number" step="1" min="1" formControlName="orderedQuantity" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@orders.unitCost">Unit cost</mat-label>
              <input matInput type="number" step="0.0001" min="0" formControlName="unitCost" />
            </mat-form-field>
          </div>
          <div class="form-actions">
            @if (canOpenCatalogue()) {
              <a mat-button routerLink="/app/catalogue/products" target="_blank" rel="noopener" i18n="@@orders.openCatalogue">Open product catalogue</a>
            }
            <button mat-button type="button" (click)="refreshVariants()" i18n="@@orders.refreshVariants">Refresh variants</button>
            <button
              mat-stroked-button
              type="submit"
              [disabled]="busy()"
              i18n="@@orders.addLine.action"
            >
              Add line
            </button>
          </div>
        </form>
      }

      <h2 class="section-title" i18n="@@orders.receive">Receive goods</h2>
      @if (
        canReceive() && (current.status === 'Ordered' || current.status === 'PartiallyReceived')
      ) {
        <div class="table-card">
          <table mat-table [dataSource]="current.lines" class="data-table">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
              <td mat-cell *matCellDef="let line">{{ variantLabel(line.productVariantId) }}</td>
            </ng-container>
            <ng-container matColumnDef="ordered">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.orderedQty">Quantity</th>
              <td mat-cell *matCellDef="let line">{{ line.orderedQuantity }}</td>
            </ng-container>
            <ng-container matColumnDef="received">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.received">Received</th>
              <td mat-cell *matCellDef="let line">{{ line.receivedQuantity }}</td>
            </ng-container>
            <ng-container matColumnDef="outstanding">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.outstanding">Still expected</th>
              <td mat-cell *matCellDef="let line">
                {{ line.orderedQuantity - line.receivedQuantity }}
              </td>
            </ng-container>
            <ng-container matColumnDef="now">
              <th mat-header-cell *matHeaderCellDef i18n="@@orders.receiveNow">Receive now</th>
              <td mat-cell *matCellDef="let line">
                @if (line.orderedQuantity - line.receivedQuantity > 0) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="qty-field">
                    <input
                      matInput
                      type="number"
                      step="1"
                      min="0"
                      [max]="line.orderedQuantity - line.receivedQuantity"
                      [value]="receiveDrafts()[line.id] ?? 0"
                      (input)="setDraft(line.id, $any($event.target).value)"
                      [attr.aria-label]="
                        'Quantity to receive for ' + variantLabel(line.productVariantId)
                      "
                    />
                  </mat-form-field>
                } @else {
                  <span class="muted" i18n="@@orders.fullyReceived">Complete</span>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="receiveColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: receiveColumns"></tr>
          </table>
        </div>
        <mat-form-field appearance="outline" class="full-row">
          <mat-label i18n="@@orders.deliveryReference">Delivery reference or note</mat-label>
          <input matInput maxlength="500" [formControl]="deliveryReference" />
        </mat-form-field>
        <div class="form-actions">
          <button
            mat-flat-button
            type="button"
            [disabled]="busy() || !hasReceiveQuantity()"
            (click)="receive(current)"
            i18n="@@orders.receive.action"
          >
            Record receipt
          </button>
        </div>
        <p class="form-hint" i18n="@@orders.receive.hint">
          A receipt adds stock to the destination location and is recorded in the audit trail.
        </p>
      } @else if (current.status === 'Draft') {
        <p class="muted" i18n="@@orders.receiveDraft">Place the order before receiving goods.</p>
      } @else {
        <p class="muted" i18n="@@orders.receiveClosed">Nothing is outstanding on this order.</p>
      }

      @if (canViewReceipts()) {
      <h2 class="section-title" i18n="@@orders.receipts">Receipts</h2>
      @if (receipts().length === 0) {
        <p class="muted" i18n="@@orders.noReceipts">No goods have been received yet.</p>
      } @else {
        <ul class="receipt-list">
          @for (receipt of receipts(); track receipt.id) {
            <li>
              <span>{{ receipt.receivedAt | date: 'medium' }}</span>
              <span class="muted">{{ receipt.receivedBy }}</span>
              <span>{{ receiptSummary(receipt) }}</span>
              @if (receipt.deliveryReference) {
                <span>{{ receipt.deliveryReference }}</span>
              }
            </li>
          }
        </ul>
      }

      }
      @if (supplierBalance(); as balance) {
        <h2 class="section-title" i18n="@@supplierPayments.title">Supplier payments</h2>
        <dl class="detail-list">
          <dt i18n="@@supplierPayments.paid">Total paid</dt><dd>{{ balance.totalPaid | number: '1.2-4' }}</dd>
          <dt i18n="@@supplierPayments.outstanding">Outstanding balance</dt><dd>{{ balance.outstanding | number: '1.2-4' }}</dd>
          <dt i18n="@@common.status">Status</dt><dd>{{ paymentStatuses[balance.status] }}</dd>
        </dl>
        @for (payment of balance.payments; track payment.id) {
          <p>{{ payment.paymentDate | date: 'mediumDate' }} · {{ paymentMethods[payment.method] }} ·
            {{ payment.amount | number: '1.2-4' }}
            @if (payment.reference) { · {{ payment.reference }} }
            @if (payment.notes) { · {{ payment.notes }} }
          </p>
        }
        @if (canManage() && balance.outstanding > 0) {
          <form class="form-surface" [formGroup]="paymentForm" (ngSubmit)="recordSupplierPayment(balance)">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label i18n="@@supplierPayments.amount">Amount</mat-label>
                <input matInput type="number" min="0.0001" [max]="balance.outstanding" step="0.0001" formControlName="amount" required />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@supplierPayments.method">Payment method</mat-label>
                <mat-select formControlName="method">
                  @for (method of paymentMethodOptions; track method) {
                    <mat-option [value]="method">{{ paymentMethods[method] }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@supplierPayments.date">Payment date</mat-label>
                <input matInput type="date" formControlName="paymentDate" required />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@supplierPayments.reference">Payment reference</mat-label>
                <input matInput maxlength="100" formControlName="reference" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@orders.field.notes">Notes</mat-label>
                <input matInput maxlength="500" formControlName="notes" />
              </mat-form-field>
            </div>
            <button mat-flat-button type="submit" [disabled]="busy() || paymentForm.invalid" i18n="@@supplierPayments.record">Record supplier payment</button>
          </form>
        }
      }
      <h2 class="section-title" i18n="@@orders.details">Details</h2>
      <dl class="detail-list">
        <dt i18n="@@orders.date">Date</dt>
        <dd>{{ current.orderDate | date: 'medium' }}</dd>
        <dt i18n="@@orders.field.destination">Receive into</dt>
        <dd>{{ locationName(current.destinationLocationId) }}</dd>
        <dt i18n="@@orders.createdBy">Created by</dt>
        <dd>{{ current.createdBy }}</dd>
        <dt i18n="@@orders.field.notes">Notes</dt>
        <dd>{{ current.notes ?? '—' }}</dd>
      </dl>
      @if (canManage() && current.status === 'Draft') {
        <div class="form-surface">
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@orders.field.notes">Notes</mat-label>
            <textarea matInput [formControl]="draftNotes" maxlength="2000" rows="3"></textarea>
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="saveDraftNotes(current)" [disabled]="busy() || draftNotes.pristine" i18n="@@orders.saveNotes">Save notes</button>
        </div>
      }
    }
  `,
  styles: `
    .total-line {
      text-align: end;
      margin-block-start: 0.5rem;
    }
    .qty-field {
      width: 8rem;
    }
    .receipt-list {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .receipt-list li {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDetailPage {
  private readonly api = inject(PurchaseOrdersApiService);
  private readonly suppliersApi = inject(SuppliersApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly catalogue = inject(VariantCatalogueService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly orderId = this.activatedRoute.snapshot.paramMap.get('id') ?? '';

  readonly errorTitle = $localize`:@@orders.detail.loadFailed:We could not load this purchase order`;
  readonly backLink = {
    label: $localize`:@@orders.backToList:All purchase orders`,
    path: '/app/purchasing/orders',
  };
  readonly lineColumns = ['product', 'ordered', 'received', 'cost', 'total'];
  readonly receiveColumns = ['product', 'ordered', 'received', 'outstanding', 'now'];

  readonly canManage = computed(() => this.session.hasPermission('purchase-orders.manage'));
  readonly canOpenCatalogue = computed(() => this.session.hasPermission('products.view'));
  readonly canViewReceipts = computed(() => this.session.hasPermission('goods-receipts.view'));
  readonly canReceive = computed(() => this.session.hasPermission('goods-receipts.manage'));
  readonly order = signal<PurchaseOrder | null>(null);
  readonly suppliers = signal<Supplier[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly receipts = signal<GoodsReceipt[]>([]);
  readonly supplierBalance = signal<SupplierPaymentBalance | null>(null);
  readonly paymentStatuses = {
    NotPayable: $localize`:@@supplierPayments.notPayable:Not payable`,
    Unpaid: $localize`:@@supplierPayments.unpaid:Unpaid`,
    PartiallyPaid: $localize`:@@supplierPayments.partial:Partially paid`,
    Paid: $localize`:@@supplierPayments.settled:Paid`,
  };
  readonly paymentMethods: Record<string, string> = {
    Cash: $localize`:@@supplierPayments.cash:Cash`,
    Card: $localize`:@@supplierPayments.card:Card`,
    BankTransfer: $localize`:@@supplierPayments.transfer:Bank transfer`,
    Cheque: $localize`:@@supplierPayments.cheque:Cheque`,
    Other: $localize`:@@supplierPayments.other:Other`,
  };
  readonly paymentMethodOptions = Object.keys(this.paymentMethods);
  readonly paymentForm = this.formBuilder.group({
    amount: this.formBuilder.control<number | null>(null, [Validators.required]),
    method: 'Cash',
    paymentDate: formatDate(new Date(), 'yyyy-MM-dd', 'en-US'),
    reference: '',
    notes: '',
  });
  private pendingPayment: { fingerprint: string; id: string } | null = null;
  readonly draftNotes = this.formBuilder.control('');
  readonly deliveryReference = this.formBuilder.control('');
  readonly receiveDrafts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  private variantNames = new Map<string, string>();
  /** Reused until a receipt succeeds, so a retry after a network failure cannot double-apply. */
  private receiptKey: string | null = null;

  readonly lineForm = this.formBuilder.group({
    productVariantId: ['', [Validators.required]],
    orderedQuantity: this.formBuilder.control<number | null>(1, [
      Validators.required,
      Validators.min(1),
    ]),
    unitCost: this.formBuilder.control<number | null>(0, [Validators.required, Validators.min(0)]),
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      order: this.api.get(this.orderId),
      supplierBalance: this.api.supplierPayments(this.orderId),
      receipts: this.canViewReceipts() ? this.api.receipts(this.orderId) : of([]),
      suppliers: this.suppliersApi.list({ search: null, isActive: null, page: 1, pageSize: 100 }),
      locations: this.locationsApi.list(),
      variants: this.catalogue.options(),
    }).subscribe({
      next: ({ order, receipts, suppliers, locations, variants, supplierBalance }) => {
        this.supplierBalance.set(supplierBalance);
        this.order.set(order);
        this.draftNotes.reset(order.notes ?? '');
        this.receipts.set(receipts);
        this.suppliers.set(suppliers);
        this.locations.set(locations);
        this.variants.set(variants);
        this.variantNames = new Map(variants.map((variant) => [variant.id, variant.label]));
        this.receiveDrafts.set({});
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@orders.detail.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  saveDraftNotes(order: PurchaseOrder): void {
    if (this.busy() || order.status !== 'Draft') return;
    this.busy.set(true);
    this.actionError.set(null);
    this.api.saveNotes(order.id, blankToNull(this.draftNotes.value)).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(describeApiError(error, $localize`:@@orders.notesFailed:The notes could not be saved.`));
      },
    });
  }

  refreshVariants(): void {
    this.catalogue.options().subscribe({
      next: (variants) => {
        this.variants.set(variants);
        this.variantNames = new Map(variants.map((variant) => [variant.id, variant.label]));
      },
      error: (error: unknown) => this.actionError.set(describeApiError(error,
        $localize`:@@orders.variantsFailed:The variants could not be refreshed.`)),
    });
  }

  addLine(current: PurchaseOrder): void {
    const value = this.lineForm.getRawValue();
    const quantity = numberOrNull(value.orderedQuantity);
    const cost = numberOrNull(value.unitCost);
    if (!value.productVariantId || quantity === null || quantity < 1 || cost === null || cost < 0) {
      this.lineForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api.addLine(current.id, value.productVariantId, quantity, cost).subscribe({
      next: () => {
        this.busy.set(false);
        this.lineForm.reset({ productVariantId: '', orderedQuantity: 1, unitCost: 0 });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(error, $localize`:@@orders.lineFailed:The line could not be added.`),
        );
      },
    });
  }

  place(current: PurchaseOrder): void {
    this.confirm
      .confirm({
        title: $localize`:@@orders.place.title:Place this order?`,
        message: $localize`:@@orders.place.message:The order is sent to the supplier and can then be received against. Lines cannot be changed after placing.`,
        confirmLabel: $localize`:@@orders.place:Place order`,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy.set(true);
        this.api.place(current.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.snackBar.open($localize`:@@orders.placed:Order placed.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@orders.placeFailed:The order could not be placed.`,
              ),
            );
          },
        });
      });
  }

  cancel(current: PurchaseOrder): void {
    this.confirm
      .confirm({
        title: $localize`:@@orders.cancel.title:Cancel this order?`,
        message: $localize`:@@orders.cancel.message:A cancelled order cannot be reopened. Goods already received are not reversed.`,
        confirmLabel: $localize`:@@orders.cancel:Cancel order`,
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
                $localize`:@@orders.cancelFailed:The order could not be cancelled.`,
              ),
            );
          },
        });
      });
  }

  setDraft(lineId: string, raw: string): void {
    const quantity = numberOrNull(raw) ?? 0;
    this.receiveDrafts.update((drafts) => ({ ...drafts, [lineId]: quantity }));
  }

  hasReceiveQuantity(): boolean {
    return Object.values(this.receiveDrafts()).some((quantity) => quantity > 0);
  }

  receive(current: PurchaseOrder): void {
    const lines = current.lines
      .map((line) => ({
        purchaseOrderLineId: line.id,
        quantityReceived: this.receiveDrafts()[line.id] ?? 0,
        outstanding: line.orderedQuantity - line.receivedQuantity,
      }))
      .filter((line) => line.quantityReceived > 0);

    if (
      lines.some(
        (line) =>
          !Number.isInteger(line.quantityReceived) || line.quantityReceived > line.outstanding,
      )
    ) {
      this.actionError.set(
        $localize`:@@orders.receiveInvalid:Enter whole numbers no larger than the outstanding quantity.`,
      );
      return;
    }
    if (lines.length === 0) {
      return;
    }

    this.receiptKey ??= crypto.randomUUID();
    this.busy.set(true);
    this.actionError.set(null);
    this.api
      .receive(
        this.receiptKey,
        current.id,
        lines.map(({ purchaseOrderLineId, quantityReceived }) => ({
          purchaseOrderLineId,
          quantityReceived,
        })),
        this.deliveryReference.value.trim(),
      )
      .subscribe({
        next: () => {
          this.receiptKey = null;
          this.deliveryReference.reset();
          this.busy.set(false);
          this.snackBar.open(
            $localize`:@@orders.receivedDone:Goods received. Stock updated.`,
            undefined,
            { duration: 3000 },
          );
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.actionError.set(
            describeApiError(
              error,
              $localize`:@@orders.receiveFailed:The receipt could not be recorded. Try again; it will not be applied twice.`,
            ),
          );
        },
      });
  }

  recordSupplierPayment(balance: SupplierPaymentBalance): void {
    const value = this.paymentForm.getRawValue();
    const amount = value.amount;
    if (this.busy() || amount === null || amount <= 0 || amount > balance.outstanding || !value.paymentDate) return;
    const fingerprint = JSON.stringify(value);
    if (this.pendingPayment?.fingerprint !== fingerprint) {
      this.pendingPayment = { fingerprint, id: crypto.randomUUID() };
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api.recordSupplierPayment(this.orderId, { ...value, amount, id: this.pendingPayment.id }).subscribe({
      next: (updated) => {
        this.supplierBalance.set(updated);
        this.paymentForm.controls.amount.reset();
        this.paymentForm.controls.reference.reset();
        this.paymentForm.controls.notes.reset();
        this.pendingPayment = null;
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(describeApiError(error, $localize`:@@supplierPayments.error:The supplier payment could not be recorded.`));
      },
    });
  }

  supplierName(): string {
    const id = this.order()?.supplierId;
    return this.suppliers().find((supplier) => supplier.id === id)?.name ?? '';
  }

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }

  variantLabel(id: string): string {
    return this.variantNames.get(id) ?? id;
  }

  receiptSummary(receipt: GoodsReceipt): string {
    return receipt.lines
      .map((line) => `${this.variantLabel(line.productVariantId)} × ${line.quantityReceived}`)
      .join(', ');
  }

  statusLabel(status: PurchaseOrder['status']): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@orders.status.draft:Draft`;
      case 'Ordered':
        return $localize`:@@orders.status.ordered:Ordered`;
      case 'PartiallyReceived':
        return $localize`:@@orders.status.partial:Partly received`;
      case 'Received':
        return $localize`:@@orders.status.received:Received`;
      case 'Cancelled':
        return $localize`:@@orders.status.cancelled:Cancelled`;
    }
  }
}
