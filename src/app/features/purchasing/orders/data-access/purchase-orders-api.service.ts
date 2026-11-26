import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../../inventory/stock/data-access/stock-api.service';

export type PurchaseOrderStatus =
  'Draft' | 'Ordered' | 'PartiallyReceived' | 'Received' | 'Cancelled';

export interface PurchaseOrderLine {
  readonly id: string;
  readonly productVariantId: string;
  readonly orderedQuantity: number;
  readonly receivedQuantity: number;
  readonly unitCost: number;
  readonly lineTotal: number;
}

export interface PurchaseOrder {
  readonly id: string;
  readonly purchaseOrderNumber: string;
  readonly supplierId: string;
  readonly destinationLocationId: string;
  readonly status: PurchaseOrderStatus;
  readonly orderDate: string;
  readonly notes: string | null;
  readonly createdBy: string;
  readonly total: number;
  readonly lines: PurchaseOrderLine[];
}

export interface PurchaseOrderFilter extends PageRequest {
  readonly supplierId: string | null;
  readonly status: PurchaseOrderStatus | null;
}

export interface SupplierPayment {
  readonly id: string;
  readonly amount: number;
  readonly method: string;
  readonly paymentDate: string;
  readonly reference: string | null;
  readonly notes: string | null;
}

export interface SupplierPaymentBalance {
  readonly orderTotal: number;
  readonly totalPaid: number;
  readonly outstanding: number;
  readonly status: 'NotPayable' | 'Unpaid' | 'PartiallyPaid' | 'Paid';
  readonly payments: SupplierPayment[];
}

export interface SupplierStatement {
  readonly outstanding: number;
  readonly orders: { orderId: string; orderNumber: string; orderStatus: PurchaseOrderStatus;
    orderDate: string; balance: SupplierPaymentBalance }[];
  readonly entries: { orderId: string; orderNumber: string; date: string;
    paymentId: string | null; change: number; reference: string | null; running: number }[];
}

export interface GoodsReceiptLine {
  readonly id: string;
  readonly purchaseOrderLineId: string;
  readonly productVariantId: string;
  readonly quantityReceived: number;
  readonly unitCost: number;
}

export interface GoodsReceipt {
  readonly id: string;
  readonly purchaseOrderId: string;
  readonly locationId: string;
  readonly receivedAt: string;
  readonly receivedBy: string;
  readonly deliveryReference: string | null;
  readonly lines: GoodsReceiptLine[];
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(filter: PurchaseOrderFilter): Observable<PurchaseOrder[]> {
    let params: HttpParams = pageParams(filter);
    if (filter.supplierId) {
      params = params.set('supplierId', filter.supplierId);
    }
    if (filter.status) {
      params = params.set('status', filter.status);
    }
    return this.http.get<PurchaseOrder[]>(this.apiUrl.path('/purchase-orders'), { params });
  }

  supplierStatement(supplierId: string): Observable<SupplierStatement> {
    return this.http.get<SupplierStatement>(this.apiUrl.path(`/purchase-orders/supplier-statement/${supplierId}`));
  }

  supplierPayments(id: string): Observable<SupplierPaymentBalance> {
    return this.http.get<SupplierPaymentBalance>(this.apiUrl.path(`/purchase-orders/${id}/payments`));
  }

  recordSupplierPayment(id: string, payment: SupplierPayment): Observable<SupplierPaymentBalance> {
    return this.http.post<SupplierPaymentBalance>(this.apiUrl.path(`/purchase-orders/${id}/payments`), payment);
  }

  get(id: string): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(this.apiUrl.path(`/purchase-orders/${id}`));
  }

  create(
    supplierId: string,
    destinationLocationId: string,
    notes: string | null,
  ): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(this.apiUrl.path('/purchase-orders'), {
      supplierId,
      destinationLocationId,
      notes,
    });
  }

  addLine(
    id: string,
    productVariantId: string,
    orderedQuantity: number,
    unitCost: number,
  ): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(this.apiUrl.path(`/purchase-orders/${id}/lines`), {
      productVariantId,
      orderedQuantity,
      unitCost,
    });
  }

  saveNotes(id: string, notes: string | null): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/purchase-orders/${id}/notes`), { notes });
  }

  /** Sends the order to the supplier. Requires at least one line. */
  place(id: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/purchase-orders/${id}/order`), null);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/purchase-orders/${id}/cancel`), null);
  }

  receipts(purchaseOrderId: string): Observable<GoodsReceipt[]> {
    return this.http.get<GoodsReceipt[]>(
      this.apiUrl.path(`/goods-receipts/by-purchase-order/${purchaseOrderId}`),
    );
  }

  /**
   * Records a receipt. The client-generated id is an idempotency key: a retried request with
   * the same id is refused as a duplicate, so it is never applied twice.
   * Requires the Audit and Inventory modules.
   */
  receive(
    id: string,
    purchaseOrderId: string,
    lines: { purchaseOrderLineId: string; quantityReceived: number }[],
    deliveryReference?: string,
  ): Observable<GoodsReceipt> {
    return this.http.post<GoodsReceipt>(this.apiUrl.path('/goods-receipts'), {
      id,
      purchaseOrderId,
      lines,
      ...(deliveryReference ? { deliveryReference } : {}),
    });
  }
}
