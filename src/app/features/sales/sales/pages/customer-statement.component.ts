import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerStatement, SalesApiService } from '../data-access/sales-api.service';

@Component({
  selector: 'app-customer-statement',
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    <h2 class="section-title" i18n="@@customerStatement.title">Customer account statement</h2>
    @if (failed()) {
      <p role="alert" i18n="@@customerStatement.failed">The customer statement could not be loaded.</p>
    }
    @if (statement(); as current) {
      <p><strong i18n="@@supplierPayments.outstanding">Outstanding balance</strong>
        {{ current.outstanding | number: '1.2-4' }}</p>
      <h3 i18n="@@customerStatement.open">Open sales</h3>
      @for (sale of current.openSales; track sale.id) {
        <p><a [routerLink]="['/app/sales/sales', sale.id]">{{ sale.number ?? sale.id }}</a> ·
          {{ sale.date | date: 'mediumDate' }} · {{ sale.total - sale.paid | number: '1.2-4' }}</p>
      } @empty {
        <p i18n="@@customerStatement.none">No open balances.</p>
      }
      <div class="table-card">
        <table class="data-table">
          <thead><tr>
            <th i18n="@@orders.date">Date</th><th i18n="@@orders.number">Number</th>
            <th i18n="@@supplierStatement.entry">Entry</th><th i18n="@@supplierPayments.amount">Amount</th>
            <th i18n="@@supplierStatement.running">Running balance</th>
          </tr></thead>
          <tbody>
            @for (entry of current.entries; track entry.paymentId ?? entry.saleId) {
              <tr>
                <td>{{ entry.date | date: 'medium' }}</td>
                <td>{{ entry.number ?? entry.saleId }}</td>
                <td>
                  @if (entry.paymentId) { <span i18n="@@supplierStatement.payment">Payment</span> }
                  @else { <span i18n="@@customerStatement.sale">Sale</span> }
                  @if (entry.reference) { · {{ entry.reference }} }
                </td>
                <td>{{ entry.change | number:'1.2-4' }}</td>
                <td>{{ entry.runningBalance | number:'1.2-4' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerStatementComponent {
  private readonly api = inject(SalesApiService);
  readonly customerId = input.required<string>();
  readonly statement = signal<CustomerStatement | null>(null);
  readonly failed = signal(false);

  constructor() {
    effect(onCleanup => {
      const id = this.customerId();
      this.statement.set(null);
      this.failed.set(false);
      const sub = this.api.customerStatement(id).subscribe({
        next: statement => this.statement.set(statement),
        error: () => this.failed.set(true),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }
}
