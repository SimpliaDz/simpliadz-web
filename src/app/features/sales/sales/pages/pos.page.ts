import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { finalize } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { CustomerDialogComponent, CustomerDialogData, CustomerDialogResult } from '../../customers/ui/customer-dialog.component';
import { DigitalCardDialogComponent } from '../../../crm/pages/digital-card-dialog.component';
import { DiscountType, PosContext, PosCustomer, PosVariant, Sale, SaleLine, SalesApiService } from '../data-access/sales-api.service';

interface HeldTicket {
  readonly id: string;
  readonly number: number;
  readonly total: number | null;
  readonly customer: PosCustomer | null;
}

@Component({
  selector: 'app-pos-page',
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-page-header title="Point of Sale" subtitle="Fast checkout for the active cash register.">
  @if (context()?.cashRegisterCode) {<span class="chip"><mat-icon>point_of_sale</mat-icon>{{ context()?.cashRegisterCode }} · {{ cashierName() }}</span><button mat-stroked-button type="button" (click)="changeRegister()"><mat-icon>swap_horiz</mat-icon>Change register</button>}
</app-page-header>
@if (context(); as ctx) {
  @if (!ctx.isClockedIn) {<mat-card appearance="outlined"><mat-card-content><h2>Clock in to start selling</h2><p class="muted">Clock in from My time, then return here.</p></mat-card-content></mat-card>}
  @else if (!ctx.cashRegisterId) {<mat-card appearance="outlined"><mat-card-content><h2>Select a cash register</h2><div class="registers">@for (r of ctx.registers; track r.id) {<button mat-stroked-button [disabled]="!r.isAvailable || !r.cashSessionId" (click)="assign(r.id)"><strong>{{ r.code }}</strong> · {{ r.name }} — {{ r.cashSessionId ? (r.isAvailable ? 'Ready' : 'In use') : 'Session closed' }}</button>}</div></mat-card-content></mat-card>}
  @else {<div class="pos-grid">
    <mat-card appearance="outlined"><mat-card-content>
      <mat-form-field appearance="outline" class="scanner"><mat-label>Scan barcode or SKU</mat-label><input #scanner matInput [(ngModel)]="code" (keydown.enter)="scanOnEnter($event)" autocomplete="off"/><button mat-icon-button matSuffix (click)="scan()"><mat-icon>add</mat-icon></button></mat-form-field>
      <mat-form-field appearance="outline" class="search"><mat-label>Find product by name</mat-label><input matInput [(ngModel)]="search" (ngModelChange)="searchChanged()" autocomplete="off"/></mat-form-field>
      @for (item of results(); track item.variantId) {<button class="result" (click)="add(item)"><span>{{ item.productName }} · {{ item.sku }}</span><strong>{{ item.price | number:'1.2-2' }}</strong></button>}
      @if (sale(); as s) {<div class="lines">@for (line of s.lines; track line.id) {<div><span class="line-item"><input #quantity class="quantity" type="number" min="1" [value]="line.quantity" [attr.max]="line.availableQuantity" (change)="setQuantity(line, quantity)" [attr.aria-label]="'Quantity for ' + (lineName(line))"/>× {{ lineName(line) }} @if (line.quantity > (line.availableQuantity ?? line.quantity)) { <small [style.color]="'var(--mat-sys-error)'">Stock discrepancy · {{ line.availableQuantity }} recorded</small> }</span>@if (line.promotionName) { <small><b>{{ line.promotionName }}</b> · <s>{{ line.unitPrice | number:'1.2-2' }}</s> → {{ (line.unitPrice - (line.promotionUnitDiscount ?? 0)) | number:'1.2-2' }} per unit</small> }<strong>{{ line.lineTotal | number:'1.2-2' }}</strong><button mat-icon-button type="button" [disabled]="editingTicket()" matTooltip="Remove item" [attr.aria-label]="'Remove ' + lineName(line)" (click)="removeLine(line.id)"><mat-icon aria-hidden="true">delete_outline</mat-icon></button></div>}</div>} @else {<p class="muted">Scan an item to begin.</p>}
    </mat-card-content></mat-card>
    <mat-card appearance="outlined" class="summary"><mat-card-content>
      <div class="customer-title">
        <div><span class="muted">Customer</span><strong>{{ customer()?.name ?? 'Walk-in customer' }}</strong>@if (customer()?.phone) {<small>{{ customer()?.phone }}</small>}</div>
        <span class="customer-actions">
          <button mat-icon-button type="button" aria-label="Find customer" matTooltip="Find customer" (click)="toggleCustomerSearch()">
            <mat-icon aria-hidden="true">person_search</mat-icon>
          </button>
          @if (canCreateCustomer()) {
            <button mat-icon-button type="button" [attr.aria-label]="newCustomerLabel" [matTooltip]="newCustomerLabel" (click)="addCustomer()">
              <mat-icon aria-hidden="true">person_add</mat-icon>
            </button>
          }
        </span>
      </div>
      @if (showCustomerSearch()) {<div class="customer-search"><mat-form-field appearance="outline"><mat-label>Name, phone or loyalty card</mat-label><input #customerInput matInput [(ngModel)]="customerSearch" (ngModelChange)="customerSearchChanged()" (keydown.enter)="submitCustomerSearch()" autocomplete="off"/></mat-form-field><button mat-button type="button" [disabled]="editingTicket() || startingTicket() || resuming()" (click)="setCustomer(null)">Use Walk-in</button>@for (item of customerResults(); track item.id) {<button class="customer-result" type="button" [disabled]="editingTicket() || startingTicket() || resuming()" (click)="setCustomer(item)"><strong>{{ item.name }}</strong><span>{{ item.phone ?? item.email ?? 'Customer' }}</span></button>}</div>}
      <h1>{{ (sale()?.total ?? 0) | number:'1.2-2' }}</h1>
      @if (sale(); as s) {<div class="discount"><select [(ngModel)]="discountType" aria-label="Discount type"><option value="Percentage">%</option><option value="FixedAmount">Amount</option></select><input type="number" min="0" [(ngModel)]="discountValue" placeholder="Discount" aria-label="Discount value"/><button mat-stroked-button type="button" (click)="applyDiscount()">Apply discount</button></div>@if (s.discountAmount) {<p class="muted">Discount: −{{ s.discountAmount | number:'1.2-2' }}</p>}}
      <p class="shortcut">Press Alt + Enter to review cash payment.</p><button mat-flat-button [disabled]="!sale()" (click)="openCheckout('Cash')">Cash</button><button mat-stroked-button [disabled]="!sale()" (click)="openCheckout('Card')">Card</button><button mat-stroked-button [disabled]="editingTicket() || !sale()" (click)="hold()">Hold ticket</button>
      <button mat-button type="button" [disabled]="editingTicket() || !sale()" (click)="cancelTicket()">Cancel ticket</button>
      @if (held().length) {
        <h2>Held tickets</h2>
        @for (ticket of held(); track ticket.id) {
          <button mat-button type="button" [disabled]="resuming() || startingTicket()" (click)="resume(ticket)">
            {{ ticket.customer?.name || 'Ticket ' + ticket.number }}
            @if (ticket.total !== null) { · {{ ticket.total | number:'1.2-2' }} }
          </button>
        }
      }
    </mat-card-content></mat-card>
  </div>}
  @if (error(); as e) {<p class="form-error">{{ e }}</p>}
}
@if (checkout(); as method) {<div class="checkout-backdrop" role="presentation"><mat-card class="checkout-dialog" role="dialog" aria-modal="true" aria-label="Confirm payment"><mat-card-content><h2>Confirm {{ method }} payment</h2><p>Close this sale for <strong>{{ (sale()?.balanceDue ?? 0) | number:'1.2-2' }}</strong>?</p><label class="print-option"><input type="checkbox" [(ngModel)]="printTicket"/> Open receipt for printing after payment</label><button #confirmButton mat-flat-button [disabled]="paying()" (click)="confirmPay()">Confirm payment <kbd>Enter</kbd></button><button mat-button (click)="closeCheckout()">Back</button></mat-card-content></mat-card></div>}
`,
  styles: `.chip{display:inline-flex;align-items:center;gap:.4rem;padding:.4rem .7rem;border-radius:999px;background:var(--app-soft-primary);color:var(--mat-sys-primary)}.registers{display:flex;flex-wrap:wrap;gap:.75rem}.pos-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(19rem,24rem);gap:1.25rem}.scanner,.search{width:100%}.result,.customer-result{display:flex;justify-content:space-between;gap:1rem;width:100%;margin-block:.25rem;padding:.65rem;border:1px solid var(--mat-sys-outline-variant);border-radius:.5rem;background:transparent;text-align:start}.customer-result{flex-direction:column;gap:.15rem}.lines div{display:flex;justify-content:space-between;align-items:center;padding:.9rem 0;border-block-end:1px solid var(--mat-sys-outline-variant)}.line-item{display:flex;align-items:center;gap:.45rem}.quantity{width:4rem;padding:.35rem;border:1px solid var(--mat-sys-outline);border-radius:.35rem;background:transparent;color:inherit;font:inherit}.summary h1{font:var(--mat-sys-display-small);font-weight:700;margin:.2rem 0 1rem}.summary>mat-card-content>button{width:100%;margin-block:.25rem}.customer-title{display:flex;justify-content:space-between;align-items:start}.customer-title div{display:grid;gap:.15rem}.customer-title small{color:var(--mat-sys-on-surface-variant)}.customer-search{margin:1rem 0}.customer-search mat-form-field{width:100%}.discount{display:grid;grid-template-columns:5rem minmax(0,1fr);gap:.5rem;margin-block:1rem}.discount button{grid-column:span 2}.discount select,.discount input{min-width:0;padding:.6rem;border:1px solid var(--mat-sys-outline);border-radius:.3rem;background:transparent;color:inherit}.shortcut{font-size:.8rem}.checkout-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:1rem;background:rgba(0,0,0,.52)}.checkout-dialog{width:min(100%,28rem)}.checkout-dialog button{width:100%;margin-block:.3rem}.print-option{display:block;margin:1rem 0}kbd{padding:.1rem .35rem;border:1px solid var(--mat-sys-outline);border-radius:.25rem}@media(max-width:899px){.pos-grid{grid-template-columns:1fr}.summary{order:-1}}`,
})
export class PosPage {
  readonly newCustomerLabel = $localize`:@@customers.create:New customer`;
  private readonly api = inject(SalesApiService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmService);
  readonly editingTicket = signal(false);
  readonly paying = signal(false);
  canCreateCustomer(): boolean {
    return this.session.hasAllPermissions(['customers.manage']);
  }
  private searchTimer?: ReturnType<typeof setTimeout>;
  private customerTimer?: ReturnType<typeof setTimeout>;
  private scanner?: ElementRef<HTMLInputElement>;
  @ViewChild('scanner') set scannerInput(input: ElementRef<HTMLInputElement> | undefined) {
    this.scanner = input;
    if (input) this.focus();
  }
  @ViewChild('confirmButton') set checkoutConfirm(button: ElementRef<HTMLButtonElement> | undefined) {
    if (button) setTimeout(() => button.nativeElement.focus());
  }
  @ViewChild('customerInput') customerInput?: ElementRef<HTMLInputElement>;
  readonly context = signal<PosContext | null>(null); readonly sale = signal<Sale | null>(null); readonly results = signal<readonly PosVariant[]>([]); readonly held = signal<readonly HeldTicket[]>([]); readonly labels = signal<ReadonlyMap<string, string>>(new Map()); readonly checkout = signal<'Cash' | 'Card' | null>(null); readonly customer = signal<PosCustomer | null>(null); readonly ticketCustomers = signal<ReadonlyMap<string, PosCustomer | null>>(new Map()); readonly showCustomerSearch = signal(false); readonly customerResults = signal<readonly PosCustomer[]>([]); readonly error = signal<string | null>(null);
  readonly resuming = signal(false);
  readonly startingTicket = signal(false);
  code = ''; search = ''; customerSearch = ''; printTicket = false; discountType: DiscountType = 'Percentage'; discountValue: number | null = null;
  constructor() {
    this.destroyRef.onDestroy(() => this.holdActiveTicket());
    this.load();
  }

  @HostListener('window:pagehide')
  holdActiveTicket(): void {
    const sale = this.sale();
    if (sale?.status === 'Draft' && sale.lines.length > 0) {
      this.parkCurrentTicket();
    }
  }
  cashierName(): string { return this.session.user()?.displayName ?? this.session.user()?.email ?? 'Cashier'; }
  lineName(line: SaleLine): string {
    return [line.productName, line.variantName, line.sku].filter(Boolean).join(' - ')
      || this.labels().get(line.productVariantId)
      || 'Product variant';
  }
  @HostListener('window:keydown', ['$event'])
  shortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || this.dialog.openDialogs.length) return;
    if (this.checkout()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeCheckout();
      }
      return;
    }
    if (event.key === 'Enter' && event.altKey && !event.ctrlKey && !event.metaKey &&
        !event.shiftKey && !event.repeat && this.sale()?.lines.length) {
      event.preventDefault();
      this.openCheckout('Cash');
    }
  }

  closeCheckout(): void {
    this.checkout.set(null);
    this.focus();
  }

  scanOnEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || event.isComposing) return;
    event.preventDefault();
    this.scan();
  }
  load(): void { this.api.posContext().subscribe({ next: x => this.setContext(x), error: e => this.fail(e, 'Could not load POS.') }); }
  changeRegister(): void { if (this.startingTicket()) return; this.holdActiveTicket(); this.api.releaseRegister().subscribe({ next: () => { this.newTicket(); this.load(); }, error: e => this.fail(e, 'Could not change register.') }); }
  assign(id: string): void { this.api.assignRegister(id).subscribe({ next: x => { this.setContext(x); this.newTicket(); }, error: e => this.fail(e, 'Could not select register.') }); }
  newTicket(): void {
    this.sale.set(null);
    this.checkout.set(null);
    this.customer.set(null);
    this.code = '';
    this.results.set([]);
    this.closeCustomerSearch();
  }
  hold(): void {
    if (!this.sale()?.lines.length || this.resuming() || this.startingTicket()) return;
    this.parkCurrentTicket();
    this.sale.set(null);
    this.newTicket();
  }

  resume(ticket: HeldTicket): void {
    const key = this.heldStorageKey();
    if (!key || this.resuming() || this.startingTicket()) return;
    this.resuming.set(true);
    this.api.posDraft(ticket.id).subscribe({
      next: (sale) => {
        this.resuming.set(false);
        if (this.heldStorageKey() !== key) return;
        this.holdActiveTicket();
        this.sale.set(sale);
        this.customer.set(ticket.customer?.id === sale.customerId ? ticket.customer : null);
        this.storeHeld(this.held().filter((item) => item.id !== ticket.id));
        this.focus();
      },
      error: (error) => {
        this.resuming.set(false);
        if (this.heldStorageKey() !== key) return;
        if (error?.status === 404) this.storeHeld(this.held().filter((item) => item.id !== ticket.id));
        this.fail(error, 'Could not resume this ticket.');
      },
    });
  }

  private parkCurrentTicket(): void {
    const sale = this.sale();
    const held = this.held();
    if (!sale || held.some((ticket) => ticket.id === sale.id)) return;
    const number = held.reduce((last, ticket) => Math.max(last, ticket.number), 0) + 1;
    this.storeHeld([...held, {
      id: sale.id, number, total: sale.lines.length ? sale.total : null, customer: this.customer(),
    }]);
  }

  private heldStorageKey(): string | null {
    const cashier = this.session.user()?.userId;
    const cashSession = this.context()?.cashSessionId;
    return cashier && cashSession ? `simpliadz.pos.held.${cashier}.${cashSession}` : null;
  }

  private setContext(context: PosContext): void {
    this.context.set(context);
    const key = this.heldStorageKey();
    try {
      this.held.set(key ? JSON.parse(sessionStorage.getItem(key) ?? '[]') : []);
    } catch {
      this.held.set([]);
    }
  }

  private storeHeld(tickets: readonly HeldTicket[]): void {
    this.held.set(tickets);
    const key = this.heldStorageKey();
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(tickets));
    } catch {
      this.error.set('Held tickets cannot be saved across refresh in this browser.');
    }
  }
  scan(confirmPhysicalStock = false): void {
    const code = this.code.trim();
    if (!code || this.startingTicket() || this.resuming() || this.editingTicket()) return;
    const current = this.sale();
    const customer = this.customer();
    this.startingTicket.set(true);
    const scan = current
      ? this.api.posScan(current.id, code, confirmPhysicalStock)
      : this.api.posCreate(code, customer?.id ?? null, confirmPhysicalStock);
    scan.pipe(finalize(() => this.startingTicket.set(false))).subscribe({
      next: (sale) => {
        this.sale.set(sale);
        if (customer) this.ticketCustomers.update(items => new Map(items).set(sale.id, customer));
        this.code = '';
        this.results.set([]);
        if (this.destroyRef.destroyed) this.holdActiveTicket();
        else this.focus();
      },
      error: error => {
        if (!confirmPhysicalStock && this.offerStockOverride(error, false, () => {
          if (this.sale()?.id === current?.id && this.code.trim() === code) this.scan(true);
        })) return;
        this.fail(error, 'Could not add this item.');
      },
    });
  }
  setQuantity(line: SaleLine, input: HTMLInputElement, confirmPhysicalStock = false): void {
    const sale = this.sale();
    const quantity = input.valueAsNumber;
    if (!sale || this.editingTicket() || !Number.isInteger(quantity) || quantity <= 0) {
      input.value = String(line.quantity);
      return;
    }
    this.api.posSetLineQuantity(sale.id, line.id, quantity, confirmPhysicalStock).subscribe({
      next: updated => { this.sale.set(updated); this.error.set(null); this.focus(); },
      error: error => {
        input.value = String(line.quantity);
        if (!confirmPhysicalStock && this.offerStockOverride(error, false, () => {
          if (this.sale()?.id !== sale.id || !input.isConnected) return;
          input.value = String(quantity);
          this.setQuantity(line, input, true);
        })) return;
        this.fail(error, 'Could not update the quantity.');
      },
    });
  }
  searchChanged(): void { if (this.searchTimer) clearTimeout(this.searchTimer); if (!this.search.trim()) { this.results.set([]); return; } this.searchTimer = setTimeout(() => this.find(), 220); }
  find(): void {
    const context = this.context();
    const query = this.search.trim();
    const locationId = context?.registers.find(register => register.id === context.cashRegisterId)?.locationId;
    if (!query || !context?.defaultPriceListId || !locationId) return;
    this.api.posSearch(query, context.defaultPriceListId, locationId).subscribe({
      next: results => {
        if (query === this.search.trim() && context.cashRegisterId === this.context()?.cashRegisterId) {
          this.results.set(results.filter(item => (item.quantityOnHand ?? 0) > 0));
        }
      },
      error: error => this.fail(error, 'Could not find products.'),
    });
  }
  add(item: PosVariant): void { this.labels.update(m => new Map(m).set(item.variantId, `${item.productName} · ${item.sku}`)); this.code = item.sku; this.scan(); }
  toggleCustomerSearch(): void {
    this.showCustomerSearch.update(x => !x);
    if (this.showCustomerSearch()) setTimeout(() => this.customerInput?.nativeElement.focus());
    else this.focus();
  }
  addCustomer(): void {
    const ticketId = this.sale()?.id;
    if (!this.canCreateCustomer()) return;

    this.dialog
      .open<CustomerDialogComponent, CustomerDialogData, CustomerDialogResult>(CustomerDialogComponent, {
        data: { customer: null, quickCreate: true },
        width: '30rem',
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result || (ticketId && this.sale()?.id !== ticketId)) {
          this.focus();
          return;
        }
        const { customer } = result;
        if (result.openLoyaltyCard) {
          this.dialog.open(DigitalCardDialogComponent, { data: customer, width: '30rem' })
            .afterClosed().subscribe(() => this.focus());
        }
        this.showCustomerSearch.set(true);
        this.customerResults.set([customer]);
        this.setCustomer(customer);
      });
  }
  customerSearchChanged(): void { if (this.customerTimer) clearTimeout(this.customerTimer); const query = this.customerSearch.trim(); if (!query) { this.customerResults.set([]); return; } this.customerTimer = setTimeout(() => this.findCustomers(query), 180); }
  submitCustomerSearch(): void {
    if (this.customerTimer) clearTimeout(this.customerTimer);
    const query = this.customerSearch.trim();
    const ticketId = this.sale()?.id;
    if (!query) return;
    this.api.posCustomers(query).subscribe({
      next: (matches) => {
        if (!this.showCustomerSearch() || this.customerSearch.trim() !== query || this.sale()?.id !== ticketId) return;
        this.customerResults.set(matches);
        if (matches.length === 1) this.setCustomer(matches[0]);
      },
      error: (error) => this.fail(error, 'Could not find customers.'),
    });
  }
  findCustomers(query: string): void { this.api.posCustomers(query).subscribe({ next: x => this.customerResults.set(x), error: e => this.fail(e, 'Could not find customers.') }); }
  setCustomer(customer: PosCustomer | null): void {
    if (this.editingTicket() || this.startingTicket() || this.resuming()) return;
    const sale = this.sale();
    const registerId = this.context()?.cashRegisterId;
    if (!registerId) return;
    if (!sale) {
      this.customer.set(customer);
      this.closeCustomerSearch();
      return;
    }

    this.editingTicket.set(true);
    const request = this.api.posSetCustomer(sale.id, customer?.id ?? null);
    request.pipe(finalize(() => this.editingTicket.set(false))).subscribe({
      next: (updated) => {
        if (this.context()?.cashRegisterId !== registerId || this.sale()?.id !== sale?.id) return;
        this.sale.set(updated);
        this.customer.set(customer);
        this.ticketCustomers.update(items => new Map(items).set(updated.id, customer));
        this.closeCustomerSearch();
      },
      error: (error) => this.fail(error, 'Could not select the customer.'),
    });
  }

  private closeCustomerSearch(): void {
    clearTimeout(this.customerTimer);
    this.showCustomerSearch.set(false);
    this.customerSearch = '';
    this.customerResults.set([]);
    this.focus();
  }
  applyDiscount(): void { const sale = this.sale(), value = this.discountValue; if (!sale || value === null || value < 0) return; this.api.setSaleDiscount(sale.id, this.discountType, value).subscribe({ next: x => { this.sale.set(x); this.discountValue = null; this.focus(); }, error: e => this.fail(e, 'Could not apply the discount.') }); }
  removeLine(lineId: string): void {
    const sale = this.sale();
    if (!sale || this.editingTicket()) return;
    this.editingTicket.set(true);
    this.api.posRemoveLine(sale.id, lineId).pipe(finalize(() => this.editingTicket.set(false))).subscribe({
      next: (updated) => {
        if (this.sale()?.id === sale.id) {
          this.sale.set(updated.lines.length ? updated : null);
          if (!updated.lines.length) this.storeHeld(this.held().filter(ticket => ticket.id !== sale.id));
        }
        this.focus();
      },
      error: (error) => this.fail(error, 'Could not remove the item.'),
    });
  }

  cancelTicket(): void {
    const sale = this.sale();
    if (!sale || this.editingTicket()) return;
    this.confirm.confirm({
      title: 'Cancel this ticket?',
      message: 'This draft will be cancelled and can no longer be resumed.',
      confirmLabel: 'Cancel ticket',
    }).subscribe((confirmed) => {
      if (!confirmed || this.sale()?.id !== sale.id || this.editingTicket()) {
        this.focus();
        return;
      }
      this.editingTicket.set(true);
      this.api.posCancel(sale.id).pipe(finalize(() => this.editingTicket.set(false))).subscribe({
        next: () => {
          this.storeHeld(this.held().filter((ticket) => ticket.id !== sale.id));
          if (this.sale()?.id !== sale.id) return;
          this.sale.set(null);
          this.code = '';
          this.newTicket();
        },
        error: (error) => this.fail(error, 'Could not cancel the ticket.'),
      });
    });
  }

  openCheckout(method: 'Cash' | 'Card'): void { if (!this.editingTicket() && this.sale()?.lines.length) this.checkout.set(method); }
  confirmPay(confirmPhysicalStock = false): void {
    const sale = this.sale(), method = this.checkout();
    if (!sale || !method || this.paying()) return;
    const wantsReceipt = this.printTicket;
    const preview = wantsReceipt ? window.open('', '_blank') : null;
    if (preview) preview.opener = null;
    this.paying.set(true);
    this.api.posPay(sale.id, sale.balanceDue, method, confirmPhysicalStock).pipe(finalize(() => this.paying.set(false))).subscribe({
      next: ({ sale: paidSale }) => {
        this.sale.set(null);
        this.storeHeld(this.held().filter((ticket) => ticket.id !== sale.id));
        if (wantsReceipt) this.openReceipt(paidSale, preview);
        this.printTicket = false;
        this.newTicket();
      },
      error: e => {
        preview?.close();
        if (!confirmPhysicalStock && this.offerStockOverride(e, true, () => {
          if (this.sale()?.id === sale.id && this.checkout() === method) this.confirmPay(true);
        })) return;
        this.fail(e, 'Payment could not be completed.');
      },
    });
  }

  private offerStockOverride(error: unknown, checkout: boolean, proceed: () => void): boolean {
    if (!(error instanceof HttpErrorResponse) ||
        (error.error?.error ?? error.error?.Error) !== 'InsufficientStock' ||
        !this.session.hasPermission('stock.manage')) return false;

    this.confirm.confirm({
      title: 'Confirm physical stock',
      message: checkout
        ? 'Some items exceed recorded stock. Count the units before continuing. Checkout records a sale-linked adjustment for the shortfall so inventory can follow up.'
        : 'The requested quantity exceeds recorded stock. Continue only if you have counted these units at this shop.',
      confirmLabel: checkout ? 'Adjust stock and complete sale' : 'Confirm units are present',
    }).subscribe(confirmed => {
      if (confirmed) proceed();
      else this.focus();
    });
    return true;
  }

  private openReceipt(sale: Sale, preview: Window | null): void {
    this.api.posReceipt(sale.id).subscribe({
      next: (pdf) => {
        const url = URL.createObjectURL(pdf);
        if (preview && !preview.closed) {
          preview.location.replace(url);
          const cleanup = setInterval(() => {
            if (!preview.closed) return;
            clearInterval(cleanup);
            URL.revokeObjectURL(url);
          }, 1000);
        } else {
          const download = document.createElement('a');
          download.href = url;
          download.download = `receipt-${sale.saleNumber ?? sale.id}.pdf`;
          download.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      },
      error: (error) => {
        preview?.close();
        this.fail(error, 'Payment recorded. The receipt could not be opened.');
      },
    });
  }
  private focus(): void {
    setTimeout(() => {
      const scanner = this.scanner?.nativeElement;
      if (!scanner?.isConnected || this.checkout() || this.dialog.openDialogs.length) return;
      const active = scanner.ownerDocument.activeElement;
      if (active !== scanner && active?.matches('input, textarea, select, [contenteditable="true"]')) return;
      scanner.focus({ preventScroll: true });
    });
  }
  private fail(error: unknown, fallback: string): void { this.error.set(describeApiError(error, fallback)); this.focus(); }
}
