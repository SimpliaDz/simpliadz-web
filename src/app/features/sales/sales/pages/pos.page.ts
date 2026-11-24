import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { DiscountType, PosContext, PosCustomer, PosVariant, Sale, SalesApiService } from '../data-access/sales-api.service';

@Component({
  selector: 'app-pos-page',
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, PageHeaderComponent],
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
      <mat-form-field appearance="outline" class="scanner"><mat-label>Scan barcode or SKU</mat-label><input #scanner matInput [(ngModel)]="code" (keydown.enter)="scan()" autocomplete="off"/><button mat-icon-button matSuffix (click)="scan()"><mat-icon>add</mat-icon></button></mat-form-field>
      <mat-form-field appearance="outline" class="search"><mat-label>Find product by name</mat-label><input matInput [(ngModel)]="search" (ngModelChange)="searchChanged()" autocomplete="off"/></mat-form-field>
      @for (item of results(); track item.variantId) {<button class="result" (click)="add(item)"><span>{{ item.productName }} · {{ item.sku }}</span><strong>{{ item.price | number:'1.2-2' }} {{ item.currencyCode }}</strong></button>}
      @if (sale(); as s) {<div class="lines">@for (line of s.lines; track line.id) {<div><span>{{ line.quantity }} × {{ labels().get(line.productVariantId) ?? 'Product variant' }}</span><strong>{{ line.lineTotal | number:'1.2-2' }}</strong></div>}</div>} @else {<p class="muted">Scan an item to begin.</p>}
    </mat-card-content></mat-card>
    <mat-card appearance="outlined" class="summary"><mat-card-content>
      <div class="customer-title"><div><span class="muted">Customer</span><strong>{{ customer()?.name ?? 'Walk-in customer' }}</strong>@if (customer()?.phone) {<small>{{ customer()?.phone }}</small>}</div><button mat-icon-button type="button" title="Find customer" (click)="toggleCustomerSearch()"><mat-icon>person_search</mat-icon></button></div>
      @if (showCustomerSearch()) {<div class="customer-search"><mat-form-field appearance="outline"><mat-label>Name, phone or loyalty card</mat-label><input #customerInput matInput [(ngModel)]="customerSearch" (ngModelChange)="customerSearchChanged()" autocomplete="off"/></mat-form-field><button mat-button type="button" (click)="setCustomer(null)">Use Walk-in</button>@for (item of customerResults(); track item.id) {<button class="customer-result" type="button" (click)="setCustomer(item)"><strong>{{ item.name }}</strong><span>{{ item.phone ?? item.email ?? 'Customer' }}</span></button>}</div>}
      <small>{{ ctx.currencyCode }}</small><h1>{{ (sale()?.total ?? 0) | number:'1.2-2' }}</h1>
      @if (sale(); as s) {<div class="discount"><select [(ngModel)]="discountType" aria-label="Discount type"><option value="Percentage">%</option><option value="FixedAmount">Amount</option></select><input type="number" min="0" [(ngModel)]="discountValue" placeholder="Discount" aria-label="Discount value"/><button mat-stroked-button type="button" (click)="applyDiscount()">Apply discount</button></div>@if (s.discountAmount) {<p class="muted">Discount: −{{ s.discountAmount | number:'1.2-2' }}</p>}}
      <p class="shortcut">Press F5 to review payment.</p><button mat-flat-button [disabled]="!sale()" (click)="openCheckout('Cash')">Cash</button><button mat-stroked-button [disabled]="!sale()" (click)="openCheckout('Card')">Card</button><button mat-stroked-button (click)="hold()">Hold ticket</button>@for (ticket of held(); track ticket.id) {<button mat-button (click)="resume(ticket)">Resume held · {{ ticket.total | number:'1.2-2' }}</button>}
    </mat-card-content></mat-card>
  </div>}
  @if (error(); as e) {<p class="form-error">{{ e }}</p>}
}
@if (checkout(); as method) {<div class="checkout-backdrop" role="presentation"><mat-card class="checkout-dialog" role="dialog" aria-modal="true" aria-label="Confirm payment"><mat-card-content><h2>Confirm {{ method }} payment</h2><p>Close this sale for <strong>{{ (sale()?.balanceDue ?? 0) | number:'1.2-2' }}</strong>?</p><label class="print-option"><input type="checkbox" [(ngModel)]="printTicket"/> Print ticket after payment</label><button mat-flat-button (click)="confirmPay()">Confirm payment <kbd>Enter</kbd></button><button mat-button (click)="checkout.set(null)">Back</button></mat-card-content></mat-card></div>}
`,
  styles: `.chip{display:inline-flex;align-items:center;gap:.4rem;padding:.4rem .7rem;border-radius:999px;background:var(--app-soft-primary);color:var(--mat-sys-primary)}.registers{display:flex;flex-wrap:wrap;gap:.75rem}.pos-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(19rem,24rem);gap:1.25rem}.scanner,.search{width:100%}.result,.customer-result{display:flex;justify-content:space-between;gap:1rem;width:100%;margin-block:.25rem;padding:.65rem;border:1px solid var(--mat-sys-outline-variant);border-radius:.5rem;background:transparent;text-align:start}.customer-result{flex-direction:column;gap:.15rem}.lines div{display:flex;justify-content:space-between;padding:.9rem 0;border-block-end:1px solid var(--mat-sys-outline-variant)}.summary h1{font:var(--mat-sys-display-small);font-weight:700;margin:.2rem 0 1rem}.summary>mat-card-content>button{width:100%;margin-block:.25rem}.customer-title{display:flex;justify-content:space-between;align-items:start}.customer-title div{display:grid;gap:.15rem}.customer-title small{color:var(--mat-sys-on-surface-variant)}.customer-search{margin:1rem 0}.customer-search mat-form-field{width:100%}.discount{display:grid;grid-template-columns:5rem minmax(0,1fr);gap:.5rem;margin-block:1rem}.discount button{grid-column:span 2}.discount select,.discount input{min-width:0;padding:.6rem;border:1px solid var(--mat-sys-outline);border-radius:.3rem;background:transparent;color:inherit}.shortcut{font-size:.8rem}.checkout-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:1rem;background:rgba(0,0,0,.52)}.checkout-dialog{width:min(100%,28rem)}.checkout-dialog button{width:100%;margin-block:.3rem}.print-option{display:block;margin:1rem 0}kbd{padding:.1rem .35rem;border:1px solid var(--mat-sys-outline);border-radius:.25rem}@media(max-width:899px){.pos-grid{grid-template-columns:1fr}.summary{order:-1}}`,
})
export class PosPage {
  private readonly api = inject(SalesApiService);
  private readonly session = inject(AuthSessionService);
  private searchTimer?: ReturnType<typeof setTimeout>;
  private customerTimer?: ReturnType<typeof setTimeout>;
  @ViewChild('scanner') scanner?: ElementRef<HTMLInputElement>;
  @ViewChild('customerInput') customerInput?: ElementRef<HTMLInputElement>;
  readonly context = signal<PosContext | null>(null); readonly sale = signal<Sale | null>(null); readonly results = signal<readonly PosVariant[]>([]); readonly held = signal<readonly Sale[]>([]); readonly labels = signal<ReadonlyMap<string, string>>(new Map()); readonly checkout = signal<'Cash' | 'Card' | null>(null); readonly customer = signal<PosCustomer | null>(null); readonly ticketCustomers = signal<ReadonlyMap<string, PosCustomer | null>>(new Map()); readonly showCustomerSearch = signal(false); readonly customerResults = signal<readonly PosCustomer[]>([]); readonly error = signal<string | null>(null);
  code = ''; search = ''; customerSearch = ''; printTicket = false; discountType: DiscountType = 'Percentage'; discountValue: number | null = null;
  constructor() { this.load(); }
  cashierName(): string { return this.session.user()?.displayName ?? this.session.user()?.email ?? 'Cashier'; }
  @HostListener('window:keydown', ['$event']) shortcut(event: KeyboardEvent): void { if (event.key === 'F5' && this.sale() && !this.checkout()) { event.preventDefault(); this.openCheckout('Cash'); } if (event.key === 'Enter' && this.checkout()) { event.preventDefault(); this.confirmPay(); } }
  load(): void { this.api.posContext().subscribe({ next: x => this.context.set(x), error: e => this.fail(e, 'Could not load POS.') }); }
  changeRegister(): void { this.api.releaseRegister().subscribe({ next: () => { this.sale.set(null); this.customer.set(null); this.results.set([]); this.load(); }, error: e => this.fail(e, 'Could not change register.') }); }
  assign(id: string): void { this.api.assignRegister(id).subscribe({ next: x => { this.context.set(x); this.newTicket(); }, error: e => this.fail(e, 'Could not select register.') }); }
  newTicket(): void { this.checkout.set(null); this.customer.set(null); this.api.posCreate().subscribe({ next: x => { this.sale.set(x); this.results.set([]); this.focus(); }, error: e => this.fail(e, 'Could not start ticket.') }); }
  hold(): void { const s = this.sale(); if (!s) return; this.held.update(x => x.some(y => y.id === s.id) ? x : [...x, s]); this.newTicket(); }
  resume(s: Sale): void { this.sale.set(s); this.customer.set(this.ticketCustomers().get(s.id) ?? null); this.held.update(x => x.filter(y => y.id !== s.id)); this.focus(); }
  scan(): void { const value = this.code.trim(); if (!value) return; if (!this.sale()) return this.newTicket(); this.api.posScan(this.sale()!.id, value).subscribe({ next: x => { this.sale.set(x); this.code = ''; this.results.set([]); this.focus(); }, error: e => this.fail(e, 'Product was not found.') }); }
  searchChanged(): void { if (this.searchTimer) clearTimeout(this.searchTimer); if (!this.search.trim()) { this.results.set([]); return; } this.searchTimer = setTimeout(() => this.find(), 220); }
  find(): void { const c = this.context(), query = this.search.trim(); if (!query || !c?.defaultPriceListId) return; this.api.posSearch(query, c.defaultPriceListId, null).subscribe({ next: x => this.results.set(x), error: e => this.fail(e, 'Could not find products.') }); }
  add(item: PosVariant): void { this.labels.update(m => new Map(m).set(item.variantId, `${item.productName} · ${item.sku}`)); this.code = item.sku; this.scan(); }
  toggleCustomerSearch(): void { this.showCustomerSearch.update(x => !x); if (this.showCustomerSearch()) setTimeout(() => this.customerInput?.nativeElement.focus()); }
  customerSearchChanged(): void { if (this.customerTimer) clearTimeout(this.customerTimer); const query = this.customerSearch.trim(); if (!query) { this.customerResults.set([]); return; } this.customerTimer = setTimeout(() => this.findCustomers(query), 180); }
  findCustomers(query: string): void { this.api.posCustomers(query).subscribe({ next: x => this.customerResults.set(x), error: e => this.fail(e, 'Could not find customers.') }); }
  setCustomer(customer: PosCustomer | null): void { const sale = this.sale(); if (!sale) return; this.api.posSetCustomer(sale.id, customer?.id ?? null).subscribe({ next: x => { this.sale.set(x); this.customer.set(customer); this.ticketCustomers.update(items => new Map(items).set(x.id, customer)); this.showCustomerSearch.set(false); this.customerSearch = ''; this.customerResults.set([]); this.focus(); }, error: e => this.fail(e, 'Could not update the customer.') }); }
  applyDiscount(): void { const sale = this.sale(), value = this.discountValue; if (!sale || value === null || value < 0) return; this.api.setSaleDiscount(sale.id, this.discountType, value).subscribe({ next: x => { this.sale.set(x); this.discountValue = null; this.focus(); }, error: e => this.fail(e, 'Could not apply the discount.') }); }
  openCheckout(method: 'Cash' | 'Card'): void { if (this.sale()?.lines.length) this.checkout.set(method); }
  confirmPay(): void { const sale = this.sale(), method = this.checkout(); if (!sale || !method) return; this.api.posPay(sale.id, sale.balanceDue, method).subscribe({ next: () => { if (this.printTicket) window.print(); this.printTicket = false; this.newTicket(); }, error: e => this.fail(e, 'Payment could not be completed.') }); }
  private focus(): void { setTimeout(() => this.scanner?.nativeElement.focus()); }
  private fail(error: unknown, fallback: string): void { this.error.set(describeApiError(error, fallback)); this.focus(); }
}
