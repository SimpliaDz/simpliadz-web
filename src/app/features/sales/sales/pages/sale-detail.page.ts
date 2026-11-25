import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin, of, switchMap } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { blankToNull, numberOrNull } from '../../../../shared/forms/form-values';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import {
  StatusChipComponent,
  StatusTone,
} from '../../../../shared/ui/status-chip/status-chip.component';
import {
  Location,
  LocationsApiService,
} from '../../../inventory/locations/data-access/locations-api.service';
import { PriceListsApiService } from '../../../inventory/price-lists/data-access/price-lists-api.service';
import {
  VariantCatalogueService,
  VariantOption,
} from '../../../inventory/stock/data-access/variant-catalogue.service';
import { CashApiService, CashSession } from '../../cash/data-access/cash-api.service';
import { Customer, CustomersApiService } from '../../customers/data-access/customers-api.service';
import {
  DiscountType,
  PaymentMethod,
  PosVariant,
  Sale,
  SaleLine,
  SaleReturn,
  SalesApiService,
  Payment,
} from '../data-access/sales-api.service';
import {
  DiscountDialogComponent,
  DiscountDialogData,
  DiscountResult,
} from '../ui/discount-dialog.component';

interface ReturnRowControl {
  readonly quantity: FormControl<number | null>;
  readonly restock: FormControl<boolean>;
}

@Component({
  selector: 'app-sale-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
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
    } @else if (sale(); as current) {
      <app-page-header
        [title]="current.saleNumber ?? draftTitle"
        [backLink]="backLink"
        [subtitle]="locationName(current.locationId) + ' · ' + priceListName(current.priceListId)"
      >
        <app-status-chip [label]="statusLabel(current.status)" [tone]="tone(current.status)" />
        <button mat-stroked-button type="button" [disabled]="busy()" (click)="downloadProForma(current)">
          Download pro-forma
        </button>
        @if (current.status === 'Completed' || current.status === 'PartiallyReturned' || current.status === 'Returned') {
          <button mat-stroked-button type="button" [disabled]="busy()" (click)="downloadReceipt(current)">
            Download receipt
          </button>
        }
        @if (canManage() && current.status === 'Draft') {
          <button
            mat-stroked-button
            type="button"
            [disabled]="busy()"
            (click)="cancel(current)"
            i18n="@@sales.cancel"
          >
            Cancel sale
          </button>
          <button
            mat-flat-button
            type="button"
            [disabled]="busy() || current.lines.length === 0"
            (click)="complete(current)"
            i18n="@@sales.complete"
          >
            Complete sale
          </button>
        }
      </app-page-header>

      @if (actionError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      <div class="card-grid">
        <mat-card appearance="outlined">
          <mat-card-header
            ><mat-card-title i18n="@@sales.summary">Totals</mat-card-title></mat-card-header
          >
          <mat-card-content>
            <dl class="detail-list">
              <dt i18n="@@sales.subtotal">Subtotal</dt>
              <dd>{{ current.subtotal | number: '1.2-2' }}</dd>
              <dt i18n="@@sales.discount">Discount</dt>
              <dd>
                {{ current.discountAmount | number: '1.2-2' }}
                @if (current.discountType) {
                  <span class="muted"
                    >({{ current.discountValue
                    }}{{ current.discountType === 'Percentage' ? '%' : '' }})</span
                  >
                }
                @if (canDiscount() && current.status === 'Draft') {
                  <button
                    mat-button
                    type="button"
                    (click)="editSaleDiscount(current)"
                    i18n="@@sales.discount.edit"
                  >
                    Change
                  </button>
                }
              </dd>
              <dt i18n="@@sales.total">Total</dt>
              <dd>
                <strong>{{ current.total | number: '1.2-2' }}</strong>
              </dd>
              <dt i18n="@@sales.paid">Paid</dt>
              <dd>{{ current.paidAmount | number: '1.2-2' }}</dd>
              <dt i18n="@@sales.balance">Balance due</dt>
              <dd>
                <strong>{{ current.balanceDue | number: '1.2-2' }}</strong>
              </dd>
            </dl>
          </mat-card-content>
        </mat-card>
      </div>

      @if (canManage() && current.status === 'Draft') {
        <h2 class="section-title" i18n="@@sales.add">Add products</h2>
        <form
          class="form-surface"
          [formGroup]="codeForm"
          (ngSubmit)="addByCode(current)"
          novalidate
        >
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@sales.scan">Scan or type a barcode or SKU</mat-label>
              <input matInput formControlName="code" maxlength="64" cdkFocusInitial />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@sales.quantity">Quantity</mat-label>
              <input matInput type="number" step="1" min="1" formControlName="quantity" />
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button mat-flat-button type="submit" [disabled]="busy()" i18n="@@sales.add.action">
              Add to sale
            </button>
          </div>
        </form>

        <form class="form-surface" [formGroup]="searchForm" (ngSubmit)="search()" novalidate>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-row">
              <mat-label i18n="@@sales.searchProducts">Search by product name</mat-label>
              <input matInput formControlName="term" maxlength="200" />
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button mat-stroked-button type="submit" [disabled]="busy()" i18n="@@common.search">
              Search
            </button>
          </div>
        </form>
        @if (results().length) {
          <div class="table-card">
            <table mat-table [dataSource]="results()" class="data-table">
              <ng-container matColumnDef="product">
                <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
                <td mat-cell *matCellDef="let row">{{ row.productName }} · {{ row.sku }}</td>
              </ng-container>
              <ng-container matColumnDef="price">
                <th mat-header-cell *matHeaderCellDef i18n="@@sales.price">Price</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.price | number: '1.2-2' }}
                </td>
              </ng-container>
              <ng-container matColumnDef="stock">
                <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.onHand">On hand</th>
                <td mat-cell *matCellDef="let row">{{ row.quantityOnHand ?? '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="add">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="visually-hidden" i18n="@@common.actions">Actions</span>
                </th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button
                    mat-stroked-button
                    type="button"
                    (click)="addVariant(current, row)"
                    [disabled]="busy()"
                  >
                    <span i18n="@@sales.add.action">Add to sale</span>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="resultColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: resultColumns"></tr>
            </table>
          </div>
        }
      }

      <h2 class="section-title" i18n="@@sales.lines">Lines</h2>
      @if (current.lines.length === 0) {
        <p class="muted" i18n="@@sales.noLines">No products yet.</p>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="current.lines" class="data-table">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
              <td mat-cell *matCellDef="let line">{{ variantLabel(line.productVariantId) }}</td>
            </ng-container>
            <ng-container matColumnDef="qty">
              <th mat-header-cell *matHeaderCellDef i18n="@@sales.quantity">Quantity</th>
              <td mat-cell *matCellDef="let line">
                {{ line.quantity }}
                @if (line.returnedQuantity) {
                  <span class="muted"> (−{{ line.returnedQuantity }})</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef i18n="@@sales.price">Price</th>
              <td mat-cell *matCellDef="let line">{{ line.unitPrice | number: '1.2-2' }}</td>
            </ng-container>
            <ng-container matColumnDef="discount">
              <th mat-header-cell *matHeaderCellDef i18n="@@sales.discount">Discount</th>
              <td mat-cell *matCellDef="let line">{{ line.discountAmount | number: '1.2-2' }}</td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef i18n="@@sales.lineTotal">Line total</th>
              <td mat-cell *matCellDef="let line">{{ line.lineTotal | number: '1.2-2' }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden" i18n="@@common.actions">Actions</span>
              </th>
              <td mat-cell *matCellDef="let line" class="actions-cell">
                @if (canDiscount() && current.status === 'Draft') {
                  <button
                    mat-button
                    type="button"
                    (click)="editLineDiscount(current, line)"
                    i18n="@@sales.discount.line"
                  >
                    Discount
                  </button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="lineColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: lineColumns"></tr>
          </table>
        </div>
      }

      <h2 class="section-title" i18n="@@sales.payments">Payments</h2>
      @if (payments().length === 0) {
        <p class="muted" i18n="@@sales.noPayments">No payments recorded.</p>
      } @else {
        <ul class="receipt-list">
          @for (payment of payments(); track payment.id) {
            <li>
              <span>{{ payment.paidAt | date: 'medium' }}</span>
              <span>{{ payment.paymentMethod }}</span>
              <span
                ><strong>{{ payment.amount | number: '1.2-2' }}</strong></span
              >
            </li>
          }
        </ul>
      }
      @if (canPay() && current.status === 'Completed') {
        <form class="form-surface" [formGroup]="paymentForm" (ngSubmit)="pay(current)" novalidate>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@sales.payment.amount">Amount</mat-label>
              <input matInput type="number" step="0.0001" min="0" formControlName="amount" />
              @if (
                paymentForm.controls.amount.hasError('required') ||
                paymentForm.controls.amount.hasError('min')
              ) {
                <mat-error i18n="@@validation.positive">Enter an amount above zero.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@sales.payment.method">Method</mat-label>
              <mat-select formControlName="paymentMethod">
                <mat-option value="Cash" i18n="@@sales.method.cash">Cash</mat-option>
                <mat-option value="Card" i18n="@@sales.method.card">Card</mat-option>
                <mat-option value="BankTransfer" i18n="@@sales.method.transfer"
                  >Bank transfer</mat-option
                >
                <mat-option value="Other" i18n="@@sales.method.other">Other</mat-option>
              </mat-select>
            </mat-form-field>
            @if (openSessions().length) {
              <mat-form-field appearance="outline">
                <mat-label i18n="@@sales.payment.session">Cash session</mat-label>
                <mat-select formControlName="cashSessionId">
                  <mat-option value="" i18n="@@common.none">None</mat-option>
                  @for (session of openSessions(); track session.id) {
                    <mat-option [value]="session.id"
                      >{{ session.openedAt | date: 'shortTime' }} ·
                      {{ session.openingCash | number: '1.0-2' }}</mat-option
                    >
                  }
                </mat-select>
              </mat-form-field>
            }
          </div>
          <div class="form-actions">
            <button
              mat-flat-button
              type="submit"
              [disabled]="busy() || current.balanceDue <= 0"
              i18n="@@sales.payment.record"
            >
              Record payment
            </button>
          </div>
        </form>
      }

      <h2 class="section-title" i18n="@@sales.returns">Returns</h2>
      @if (returns().length === 0) {
        <p class="muted" i18n="@@sales.noReturns">No returns.</p>
      } @else {
        <ul class="receipt-list">
          @for (ret of returns(); track ret.id) {
            <li>
              <span>{{ ret.returnNumber }}</span>
              <span>{{ ret.returnDate | date: 'medium' }}</span>
              <span>{{ ret.reason }}</span>
              <span
                ><strong>{{ ret.refundTotal | number: '1.2-2' }}</strong></span
              >
            </li>
          }
        </ul>
      }
      @if (
        canReturn() &&
        (current.status === 'Completed' || current.status === 'PartiallyReturned') &&
        returnableLines(current).length
      ) {
        <form
          class="form-surface"
          [formGroup]="returnForm"
          (ngSubmit)="recordReturn(current)"
          novalidate
        >
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-row">
              <mat-label i18n="@@sales.returns.reason">Reason</mat-label>
              <input matInput formControlName="reason" maxlength="500" />
              @if (returnForm.controls.reason.hasError('required')) {
                <mat-error i18n="@@validation.required">This field is required.</mat-error>
              }
            </mat-form-field>
          </div>
          <div class="table-card">
            <table mat-table [dataSource]="returnableLines(current)" class="data-table">
              <ng-container matColumnDef="product">
                <th mat-header-cell *matHeaderCellDef i18n="@@stock.column.product">Product</th>
                <td mat-cell *matCellDef="let line">{{ variantLabel(line.productVariantId) }}</td>
              </ng-container>
              <ng-container matColumnDef="available">
                <th mat-header-cell *matHeaderCellDef i18n="@@sales.returns.available">
                  Can return
                </th>
                <td mat-cell *matCellDef="let line">{{ line.quantity - line.returnedQuantity }}</td>
              </ng-container>
              <ng-container matColumnDef="qty">
                <th mat-header-cell *matHeaderCellDef i18n="@@sales.returns.quantity">
                  Return now
                </th>
                <td mat-cell *matCellDef="let line">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="qty-field">
                    <input
                      matInput
                      type="number"
                      step="1"
                      min="0"
                      [max]="line.quantity - line.returnedQuantity"
                      [formControl]="returnRow(line.id).quantity"
                      [attr.aria-label]="
                        'Return quantity for ' + variantLabel(line.productVariantId)
                      "
                    />
                  </mat-form-field>
                </td>
              </ng-container>
              <ng-container matColumnDef="restock">
                <th mat-header-cell *matHeaderCellDef i18n="@@sales.returns.restock">
                  Put back in stock
                </th>
                <td mat-cell *matCellDef="let line">
                  <mat-checkbox
                    [formControl]="returnRow(line.id).restock"
                    [attr.aria-label]="'Restock ' + variantLabel(line.productVariantId)"
                  ></mat-checkbox>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="returnColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: returnColumns"></tr>
            </table>
          </div>
          @if (returnError(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }
          <div class="form-actions">
            <button mat-flat-button type="submit" [disabled]="busy()" i18n="@@sales.returns.record">
              Record return
            </button>
          </div>
          <p class="form-hint" i18n="@@sales.returns.hint">
            A return does not change the amount paid and creates no refund payment.
          </p>
        </form>
      }
    }
  `,
  styles: `
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
    .qty-field {
      width: 7rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleDetailPage {
  private readonly api = inject(SalesApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly cashApi = inject(CashApiService);
  private readonly priceListsApi = inject(PriceListsApiService);
  private readonly catalogue = inject(VariantCatalogueService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly saleId = this.activatedRoute.snapshot.paramMap.get('id') ?? '';

  readonly errorTitle = $localize`:@@sales.detail.loadFailed:We could not load this sale`;
  readonly draftTitle = $localize`:@@sales.draftTitle:Draft sale`;
  readonly backLink = { label: $localize`:@@sales.backToList:All sales`, path: '/app/sales/sales' };
  readonly lineColumns = ['product', 'qty', 'price', 'discount', 'total', 'actions'];
  readonly resultColumns = ['product', 'price', 'stock', 'add'];
  readonly returnColumns = ['product', 'available', 'qty', 'restock'];

  readonly canManage = computed(() => this.session.hasPermission('sales.manage'));
  readonly canDiscount = computed(() => this.session.hasPermission('sales.discounts.apply'));
  readonly canPay = computed(() => this.session.hasPermission('sales.payments.manage'));
  readonly canReturn = computed(() => this.session.hasPermission('sales.returns.manage'));

  readonly sale = signal<Sale | null>(null);
  readonly payments = signal<Payment[]>([]);
  readonly returns = signal<SaleReturn[]>([]);
  readonly openSessions = signal<CashSession[]>([]);
  readonly results = signal<PosVariant[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly priceListNames = signal<Map<string, string>>(new Map());
  readonly customers = signal<Customer[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly returnError = signal<string | null>(null);
  private variantNames = new Map<string, string>();
  private returnRows = new Map<string, ReturnRowControl>();

  readonly codeForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.maxLength(64)]],
    quantity: this.formBuilder.control<number | null>(1, [Validators.required, Validators.min(1)]),
  });
  readonly searchForm = this.formBuilder.group({
    term: ['', [Validators.required, Validators.maxLength(200)]],
  });
  readonly paymentForm = this.formBuilder.group({
    amount: this.formBuilder.control<number | null>(null, [Validators.required, Validators.min(0)]),
    paymentMethod: this.formBuilder.control<PaymentMethod>('Cash'),
    cashSessionId: [''],
  });
  readonly returnForm = this.formBuilder.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .get(this.saleId)
      .pipe(
        switchMap((sale) =>
          forkJoin({
            sale: of(sale),
            payments: this.api.payments(sale.id),
            returns: this.api.returns(sale.id),
            locations: this.locationsApi.list(),
            variants: this.catalogue.options(),
            openSessions: this.cashApi.openSessions(sale.locationId),
            customers: this.customersApi.list({
              search: null,
              customerType: null,
              isActive: null,
              page: 1,
              pageSize: 100,
            }),
            priceLists: this.priceListsApi.list(),
          }),
        ),
      )
      .subscribe({
        next: ({
          sale,
          payments,
          returns,
          locations,
          variants,
          openSessions,
          customers,
          priceLists,
        }) => {
          this.priceListNames.set(new Map(priceLists.map((list) => [list.id, list.name])));
          this.sale.set(sale);
          this.payments.set(payments);
          this.returns.set(returns);
          this.locations.set(locations);
          this.variants.set(variants);
          this.variantNames = new Map(variants.map((variant) => [variant.id, variant.label]));
          this.openSessions.set(openSessions);
          this.customers.set(customers);
          this.paymentForm.patchValue({ amount: sale.balanceDue });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            describeApiError(
              error,
              $localize`:@@sales.detail.loadFailedHint:Try again in a moment.`,
            ),
          );
        },
      });
  }

  // ---- POS ---------------------------------------------------------------

  addByCode(current: Sale): void {
    const value = this.codeForm.getRawValue();
    const quantity = numberOrNull(value.quantity);
    const code = value.code.trim();
    if (!code || quantity === null || quantity < 1) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api.posByBarcode(code, current.priceListId, current.locationId).subscribe({
      next: (variant) => this.addVariant(current, variant, quantity, 'barcode'),
      error: () => {
        this.api.posBySku(code, current.priceListId, current.locationId).subscribe({
          next: (variant) => this.addVariant(current, variant, quantity, 'sku'),
          error: (error: unknown) => {
            this.busy.set(false);
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@sales.notFound:No active product with that barcode or SKU has a price in this price list.`,
              ),
            );
          },
        });
      },
    });
  }

  search(): void {
    const current = this.sale();
    const term = this.searchForm.getRawValue().term.trim();
    if (!current || !term) {
      this.searchForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.api.posSearch(term, current.priceListId, current.locationId).subscribe({
      next: (rows) => {
        this.results.set(rows);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(error, $localize`:@@sales.searchFailed:The search failed.`),
        );
      },
    });
  }

  addVariant(
    current: Sale,
    variant: PosVariant,
    quantity = 1,
    by: 'sku' | 'barcode' = 'sku',
  ): void {
    this.busy.set(true);
    this.actionError.set(null);
    const identifier =
      by === 'barcode' && variant.barcode ? { barcode: variant.barcode } : { sku: variant.sku };
    this.api.addLine(current.id, identifier, quantity, 0).subscribe({
      next: () => {
        this.busy.set(false);
        this.results.set([]);
        this.codeForm.reset({ code: '', quantity: 1 });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(
            error,
            $localize`:@@sales.lineFailed:The product could not be added to the sale.`,
          ),
        );
      },
    });
  }

  // ---- Discounts ----------------------------------------------------------

  editSaleDiscount(current: Sale): void {
    this.openDiscount(
      $localize`:@@sales.discount.sale:Sale discount`,
      current.discountType,
      current.discountValue,
      (result) => this.api.setSaleDiscount(current.id, result.type, result.value),
    );
  }

  editLineDiscount(current: Sale, line: SaleLine): void {
    this.openDiscount(
      this.variantLabel(line.productVariantId),
      line.discountType,
      line.discountValue,
      (result) => this.api.setLineDiscount(current.id, line.id, result.type, result.value),
    );
  }

  private openDiscount(
    title: string,
    type: DiscountType | null,
    value: number | null,
    apply: (result: DiscountResult) => ReturnType<SalesApiService['setSaleDiscount']>,
  ): void {
    const data: DiscountDialogData = { title, type, value };
    this.dialog
      .open<DiscountDialogComponent, DiscountDialogData, DiscountResult>(DiscountDialogComponent, {
        data,
        width: '26rem',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }
        apply(result).subscribe({
          next: () => this.load(),
          error: (error: unknown) =>
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@sales.discountFailed:The discount could not be applied.`,
              ),
            ),
        });
      });
  }

  // ---- Lifecycle ----------------------------------------------------------

  complete(current: Sale): void {
    this.confirm
      .confirm({
        title: $localize`:@@sales.complete.title:Complete this sale?`,
        message: $localize`:@@sales.complete.message:Stock for each line is reduced now. The sale can then be paid. If stock is short, the sale stays a draft.`,
        confirmLabel: $localize`:@@sales.complete:Complete sale`,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy.set(true);
        this.api.complete(current.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.snackBar.open($localize`:@@sales.completed:Sale completed.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@sales.completeFailed:The sale could not be completed.`,
              ),
            );
          },
        });
      });
  }

  downloadProForma(current: Sale): void {
    this.downloadDocument(this.api.proFormaPdf(current.id), `pro-forma-${current.saleNumber ?? current.id}.pdf`);
  }

  downloadReceipt(current: Sale): void {
    this.downloadDocument(this.api.receiptPdf(current.id), `receipt-${current.saleNumber ?? current.id}.pdf`);
  }

  private downloadDocument(request: ReturnType<SalesApiService['proFormaPdf']>, fileName: string): void {
    request.subscribe({
      next: (content) => {
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => this.actionError.set(describeApiError(error, 'The PDF could not be generated.')),
    });
  }

  cancel(current: Sale): void {
    this.confirm
      .confirm({
        title: $localize`:@@sales.cancel.title:Cancel this draft sale?`,
        message: $localize`:@@sales.cancel.message:Only drafts can be cancelled. Nothing has left stock yet. The cancellation is recorded in the audit trail.`,
        confirmLabel: $localize`:@@sales.cancel:Cancel sale`,
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
                $localize`:@@sales.cancelFailed:The sale could not be cancelled.`,
              ),
            );
          },
        });
      });
  }

  // ---- Payments -----------------------------------------------------------

  pay(current: Sale): void {
    const value = this.paymentForm.getRawValue();
    const amount = numberOrNull(value.amount);
    if (amount === null || amount <= 0) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api
      .recordPayment(current.id, {
        id: crypto.randomUUID(),
        amount,
        paymentMethod: value.paymentMethod,
        cashSessionId: blankToNull(value.cashSessionId),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.snackBar.open($localize`:@@sales.paid.done:Payment recorded.`, undefined, {
            duration: 3000,
          });
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.actionError.set(
            describeApiError(
              error,
              $localize`:@@sales.paymentFailed:The payment could not be recorded.`,
            ),
          );
        },
      });
  }

  // ---- Returns ------------------------------------------------------------

  returnRow(lineId: string): ReturnRowControl {
    let row = this.returnRows.get(lineId);
    if (!row) {
      row = {
        quantity: this.formBuilder.control<number | null>(0, [Validators.min(0)]),
        restock: this.formBuilder.control(true),
      };
      this.returnRows.set(lineId, row);
    }
    return row;
  }

  returnableLines(current: Sale): SaleLine[] {
    return current.lines.filter((line) => line.quantity - line.returnedQuantity > 0);
  }

  recordReturn(current: Sale): void {
    if (this.returnForm.invalid) {
      this.returnForm.markAllAsTouched();
      return;
    }
    const lines = this.returnableLines(current)
      .map((line) => ({
        originalSaleLineId: line.id,
        quantity: numberOrNull(this.returnRow(line.id).quantity.value) ?? 0,
        restock: this.returnRow(line.id).restock.value,
        available: line.quantity - line.returnedQuantity,
      }))
      .filter((line) => line.quantity > 0);

    if (lines.length === 0) {
      this.returnError.set(
        $localize`:@@sales.returns.none:Enter a quantity for at least one line.`,
      );
      return;
    }
    if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity > line.available)) {
      this.returnError.set(
        $localize`:@@sales.returns.tooMany:Enter whole numbers no larger than the quantity that can still be returned.`,
      );
      return;
    }

    this.busy.set(true);
    this.returnError.set(null);
    this.api
      .recordReturn(current.id, {
        id: crypto.randomUUID(),
        locationId: current.locationId,
        reason: this.returnForm.getRawValue().reason.trim(),
        lines: lines.map(({ originalSaleLineId, quantity, restock }) => ({
          originalSaleLineId,
          quantity,
          restock,
        })),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.returnForm.reset({ reason: '' });
          this.returnRows.clear();
          this.snackBar.open($localize`:@@sales.returns.done:Return recorded.`, undefined, {
            duration: 3000,
          });
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.returnError.set(
            describeApiError(
              error,
              $localize`:@@sales.returns.failed:The return could not be recorded.`,
            ),
          );
        },
      });
  }

  // ---- Labels -------------------------------------------------------------

  locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }

  priceListName(id: string): string {
    return this.priceListNames().get(id) ?? '';
  }

  variantLabel(id: string): string {
    return this.variantNames.get(id) ?? id;
  }

  statusLabel(status: Sale['status']): string {
    switch (status) {
      case 'Draft':
        return $localize`:@@sales.status.draft:Draft`;
      case 'Completed':
        return $localize`:@@sales.status.completed:Completed`;
      case 'PartiallyReturned':
        return $localize`:@@sales.status.partial:Partly returned`;
      case 'Returned':
        return $localize`:@@sales.status.returned:Returned`;
      case 'Cancelled':
        return $localize`:@@sales.status.cancelled:Cancelled`;
    }
  }

  tone(status: Sale['status']): StatusTone {
    return status === 'Completed'
      ? 'success'
      : status === 'Cancelled' || status === 'Returned'
        ? 'warning'
        : 'neutral';
  }
}
