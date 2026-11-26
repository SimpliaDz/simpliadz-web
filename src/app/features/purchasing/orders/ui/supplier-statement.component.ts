import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PurchaseOrdersApiService, PurchaseOrderStatus, SupplierStatement } from '../data-access/purchase-orders-api.service';

@Component({
  selector: 'app-supplier-statement',
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, RouterLink],
  template: `
    <h2 class="section-title" i18n="@@supplierStatement.title">Supplier account statement</h2>
    @if (failed()) {
      <p role="alert" i18n="@@supplierStatement.failed">The supplier statement could not be loaded.</p>
    }
    @if (statement(); as current) {
      <button mat-stroked-button type="button" (click)="print()" i18n="@@supplierStatement.print">Print statement</button>
      <p><strong i18n="@@supplierStatement.debt">Total supplier debt</strong>
        {{ current.outstanding | number: '1.2-4' }}</p>
      <div class="toolbar">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@supplierStatement.from">From date</mat-label>
          <input matInput type="date" (input)="from.set($any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@supplierStatement.to">To date</mat-label>
          <input matInput type="date" (input)="to.set($any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@supplierStatement.paymentStatus">Payment status</mat-label>
          <mat-select [value]="paymentStatus()" (selectionChange)="paymentStatus.set($event.value)">
            <mat-option value="" i18n="@@common.all">All</mat-option>
            <mat-option value="Unpaid" i18n="@@supplierPayments.unpaid">Unpaid</mat-option>
            <mat-option value="PartiallyPaid" i18n="@@supplierPayments.partial">Partially paid</mat-option>
            <mat-option value="Paid" i18n="@@supplierPayments.settled">Paid</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      @for (order of orders(); track order.orderId) {
        <p><a [routerLink]="['/app/purchasing/orders', order.orderId]">{{ order.orderNumber }}</a> ·
          {{ order.orderDate | date: 'mediumDate' }} ·
          <span i18n="@@supplierPayments.outstanding">Outstanding balance</span>
          {{ order.balance.outstanding | number: '1.2-4' }}
        </p>
      }
      <div class="table-card">
        <table class="data-table">
          <thead><tr>
            <th i18n="@@orders.date">Date</th>
            <th i18n="@@orders.number">Number</th>
            <th i18n="@@supplierStatement.entry">Entry</th>
            <th i18n="@@supplierPayments.amount">Amount</th>
            <th i18n="@@supplierStatement.running">Running balance</th>
          </tr></thead>
          <tbody>
            @for (row of entries(); track row.paymentId ?? row.orderId) {
              <tr>
                <td>{{ row.date | date: 'mediumDate' }}</td>
                <td>{{ row.orderNumber }}</td>
                <td>
                  @if (row.paymentId) {
                    <span i18n="@@supplierStatement.payment">Payment</span>
                  } @else {
                    <span i18n="@@supplierStatement.order">Purchase order</span>
                  }
                  @if (row.reference) { · {{ row.reference }} }
                </td>
                <td>{{ row.change | number: '1.2-4' }}</td>
                <td>{{ row.running | number: '1.2-4' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierStatementComponent {
  private readonly api = inject(PurchaseOrdersApiService);
  readonly supplierId = input.required<string>();
  readonly orderStatus = input<PurchaseOrderStatus | null>(null);
  readonly statement = signal<SupplierStatement | null>(null);
  readonly failed = signal(false);
  readonly from = signal('');
  readonly to = signal('');
  readonly paymentStatus = signal('');

  readonly orders = computed(() => (this.statement()?.orders ?? []).filter(order =>
    (!this.orderStatus() || order.orderStatus === this.orderStatus()) &&
    (!this.paymentStatus() || order.balance.status === this.paymentStatus()) &&
    this.inRange(order.orderDate.slice(0, 10))));
  readonly entries = computed(() => {

    const included = new Set((this.statement()?.orders ?? []).filter(order =>
      (!this.orderStatus() || order.orderStatus === this.orderStatus()) &&
      (!this.paymentStatus() || order.balance.status === this.paymentStatus())).map(order => order.orderId));
    return (this.statement()?.entries ?? []).filter(row => included.has(row.orderId) && this.inRange(row.date));
  });

  constructor() {
    effect(onCleanup => {
      const supplier = this.supplierId();
      this.statement.set(null);
      this.failed.set(false);
      const sub = this.api.supplierStatement(supplier).subscribe({
        next: (statement) => this.statement.set(statement),
        error: () => this.failed.set(true),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  print(): void { window.print(); }

  private inRange(date: string): boolean {
    return (!this.from() || date >= this.from()) && (!this.to() || date <= this.to());
  }
}
