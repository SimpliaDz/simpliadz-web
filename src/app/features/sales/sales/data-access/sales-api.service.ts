import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../../inventory/stock/data-access/stock-api.service';

export type SaleStatus = 'Draft' | 'Completed' | 'Cancelled' | 'PartiallyReturned' | 'Returned';
export type DiscountType = 'FixedAmount' | 'Percentage';
export type PaymentMethod = 'Cash' | 'Card' | 'BankTransfer' | 'Other';

export interface SaleLine {
  readonly id: string;
  readonly productVariantId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly unitCostSnapshot: number;
  readonly discountAmount: number;
  readonly lineTotal: number;
  readonly discountType: DiscountType | null;
  readonly discountValue: number | null;
  readonly returnedQuantity: number;
}

export interface Sale {
  readonly id: string;
  readonly saleNumber: string | null;
  readonly locationId: string;
  readonly customerId: string | null;
  readonly cashierId: string;
  readonly priceListId: string;
  readonly status: SaleStatus;
  readonly saleDate: string;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly total: number;
  readonly lines: SaleLine[];
  readonly discountType: DiscountType | null;
  readonly discountValue: number | null;
  readonly paidAmount: number;
  readonly balanceDue: number;
}

export interface Payment {
  readonly id: string;
  readonly saleId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly paidAt: string;
  readonly receivedBy: string;
  readonly cashSessionId: string | null;
}

export interface SaleReturnLine {
  readonly id: string;
  readonly originalSaleLineId: string;
  readonly productVariantId: string;
  readonly quantity: number;
  readonly unitRefundAmount: number;
  readonly refundAmount: number;
  readonly restock: boolean;
}

export interface SaleReturn {
  readonly id: string;
  readonly returnNumber: string;
  readonly originalSaleId: string;
  readonly locationId: string;
  readonly returnDate: string;
  readonly reason: string;
  readonly createdBy: string;
  readonly refundTotal: number;
  readonly lines: SaleReturnLine[];
}

export interface PosVariant {
  readonly productId: string;
  readonly productName: string;
  readonly variantId: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly color: string | null;
  readonly size: string | null;
  readonly price: number;
  readonly currencyCode: string;
  readonly quantityOnHand: number | null;
}

export interface SaleFilter extends PageRequest {
  readonly locationId: string | null;
  readonly customerId: string | null;
  readonly status: SaleStatus | null;
}

export interface NewSaleRequest {
  readonly locationId: string;
  readonly customerId: string | null;
  readonly priceListId: string;
}
export interface PosContext { readonly isClockedIn: boolean; readonly cashRegisterId: string | null; readonly cashRegisterCode: string | null; readonly cashRegisterName: string | null; readonly cashSessionId: string | null; readonly defaultPriceListId: string | null; readonly currencyCode: string | null; readonly registers: readonly { id: string; code: string; name: string; cashSessionId: string | null; occupiedByUserId: string | null; isAvailable: boolean }[]; }
export interface PosCustomer { readonly id: string; readonly name: string; readonly phone: string | null; readonly email: string | null; }

@Injectable({ providedIn: 'root' })
export class SalesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(filter: SaleFilter): Observable<Sale[]> {
    let params: HttpParams = pageParams(filter);
    if (filter.locationId) {
      params = params.set('locationId', filter.locationId);
    }
    if (filter.customerId) {
      params = params.set('customerId', filter.customerId);
    }
    if (filter.status) {
      params = params.set('status', filter.status);
    }
    return this.http.get<Sale[]>(this.apiUrl.path('/sales'), { params });
  }

  get(id: string): Observable<Sale> {
    return this.http.get<Sale>(this.apiUrl.path(`/sales/${id}`));
  }

  create(request: NewSaleRequest): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl.path('/sales'), request);
  }

  posContext(): Observable<PosContext> { return this.http.get<PosContext>(this.apiUrl.path('/pos/context')); }
  assignRegister(id: string): Observable<PosContext> { return this.http.post<PosContext>(this.apiUrl.path(`/pos/registers/${id}/assign`), null); }
  releaseRegister(): Observable<void> { return this.http.delete<void>(this.apiUrl.path('/pos/register-assignment')); }
  posCreate(customerId: string | null = null): Observable<Sale> { return this.http.post<Sale>(this.apiUrl.path('/pos/sales'), { customerId }); }
  posScan(saleId: string, code: string): Observable<Sale> { return this.http.post<Sale>(this.apiUrl.path(`/pos/sales/${saleId}/scan`), { code }); }
  posSetCustomer(saleId: string, customerId: string | null): Observable<Sale> { return this.http.put<Sale>(this.apiUrl.path(`/pos/sales/${saleId}/customer`), { customerId }); }
  posCustomers(search: string): Observable<PosCustomer[]> { return this.http.get<PosCustomer[]>(this.apiUrl.path('/pos/customers'), { params: new HttpParams().set('search', search) }); }
  posPay(saleId: string, amount: number, method: PaymentMethod): Observable<{ sale: Sale; payment: Payment }> { return this.http.post<{ sale: Sale; payment: Payment }>(this.apiUrl.path(`/pos/sales/${saleId}/pay`), { id: crypto.randomUUID(), amount, paymentMethod: method }); }

  /** Adds one unit line by exact SKU or barcode. Adding a discount requires the discount permission. */
  addLine(
    id: string,
    identifier: { sku: string } | { barcode: string },
    quantity: number,
    discountAmount: number,
  ): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl.path(`/sales/${id}/lines`), {
      sku: 'sku' in identifier ? identifier.sku : null,
      barcode: 'barcode' in identifier ? identifier.barcode : null,
      quantity,
      discountAmount,
    });
  }

  setLineDiscount(id: string, lineId: string, type: DiscountType, value: number): Observable<Sale> {
    return this.http.put<Sale>(this.apiUrl.path(`/sales/${id}/lines/${lineId}/discount`), {
      type,
      value,
    });
  }

  setSaleDiscount(id: string, type: DiscountType, value: number): Observable<Sale> {
    return this.http.put<Sale>(this.apiUrl.path(`/sales/${id}/discount`), { type, value });
  }

  complete(id: string): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl.path(`/sales/${id}/complete`), null);
  }

  /** Draft sales only. Requires the Audit module. */
  cancel(id: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/sales/${id}/cancel`), null);
  }

  payments(saleId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(this.apiUrl.path(`/sales/${saleId}/payments`));
  }

  /** The client-generated id is an idempotency key; a retried request cannot pay twice. */
  recordPayment(
    saleId: string,
    request: {
      id: string;
      amount: number;
      paymentMethod: PaymentMethod;
      cashSessionId: string | null;
    },
  ): Observable<Payment> {
    return this.http.post<Payment>(this.apiUrl.path(`/sales/${saleId}/payments`), request);
  }

  returns(saleId: string): Observable<SaleReturn[]> {
    return this.http.get<SaleReturn[]>(this.apiUrl.path(`/sales/${saleId}/returns`));
  }

  /** Refund is pro-rated, including the sale-level discount. Payments are not changed. */
  recordReturn(
    saleId: string,
    request: {
      id: string;
      locationId: string;
      reason: string;
      lines: { originalSaleLineId: string; quantity: number; restock: boolean }[];
    },
  ): Observable<SaleReturn> {
    return this.http.post<SaleReturn>(this.apiUrl.path(`/sales/${saleId}/returns`), request);
  }

  posByBarcode(
    barcode: string,
    priceListId: string,
    locationId: string | null,
  ): Observable<PosVariant> {
    return this.http.get<PosVariant>(
      this.apiUrl.path(`/pos/products/by-barcode/${encodeURIComponent(barcode)}`),
      {
        params: posParams(priceListId, locationId),
      },
    );
  }

  posBySku(sku: string, priceListId: string, locationId: string | null): Observable<PosVariant> {
    return this.http.get<PosVariant>(
      this.apiUrl.path(`/pos/products/by-sku/${encodeURIComponent(sku)}`),
      {
        params: posParams(priceListId, locationId),
      },
    );
  }

  posSearch(
    search: string,
    priceListId: string,
    locationId: string | null,
  ): Observable<PosVariant[]> {
    return this.http.get<PosVariant[]>(this.apiUrl.path('/pos/products'), {
      params: posParams(priceListId, locationId).set('search', search).set('pageSize', '25'),
    });
  }
}

function posParams(priceListId: string, locationId: string | null): HttpParams {
  let params = new HttpParams().set('priceListId', priceListId);
  if (locationId) {
    params = params.set('locationId', locationId);
  }
  return params;
}
