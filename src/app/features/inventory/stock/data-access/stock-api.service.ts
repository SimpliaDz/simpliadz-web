import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface StockBalance {
  readonly productVariantId: string;
  readonly locationId: string;
  readonly quantityOnHand: number;
  readonly updatedAt: string;
}

export interface StockOverview {
  readonly balances: StockBalance[];
  readonly prices: { productVariantId: string; priceListName: string; currencyCode: string; price: number }[];
  readonly attributes: { productVariantId: string; values: string[] }[];
}

export type StockMovementType =
  | 'Receipt'
  | 'Issue'
  | 'ReturnIn'
  | 'Adjustment'
  | 'TransferIn'
  | 'TransferOut'
  | 'OpeningBalance'
  | 'PurchaseReceipt'
  | 'Sale'
  | 'SaleReturn';

export interface StockMovement {
  readonly id: string;
  readonly productVariantId: string;
  readonly locationId: string;
  readonly quantityDelta: number;
  readonly movementType: StockMovementType;
  readonly reference: string | null;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly reason: string | null;
  readonly occurredAt: string;
  readonly createdBy: string;
}

export interface InventoryPolicy {
  readonly productVariantId: string;
  readonly locationId: string;
  readonly reorderPoint: number;
  readonly targetStockLevel: number | null;
  readonly quantityOnHand: number;
  readonly isBelowReorderPoint: boolean;
  readonly isOutOfStock: boolean;
  readonly updatedAt: string;
}

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface MovementFilter extends PageRequest {
  readonly productVariantId: string | null;
  readonly locationId: string | null;
}

export interface PolicyFilter extends PageRequest {
  readonly locationId: string | null;
  readonly belowReorderPoint: boolean | null;
  readonly outOfStock: boolean | null;
}

export interface OpeningStockRequest {
  readonly productVariantId: string;
  readonly locationId: string;
  readonly quantity: number;
  readonly reason: string | null;
}

export interface ReceiveStockRequest {
  readonly productVariantId: string;
  readonly locationId: string;
  readonly quantity: number;
  readonly reference: string | null;
  readonly reason: string | null;
}

/** Exactly one of quantityOnHand (set the count) or quantityDelta (change it) is sent. */
export interface AdjustStockRequest {
  readonly productVariantId: string;
  readonly locationId: string;
  readonly quantityOnHand?: number;
  readonly quantityDelta?: number;
  readonly reason: string;
}

export interface PolicyRequest {
  readonly reorderPoint: number;
  readonly targetStockLevel: number | null;
}

@Injectable({ providedIn: 'root' })
export class StockApiService {
  overview(): Observable<StockOverview> {
    return this.http.get<StockOverview>(this.apiUrl.path('/stock/overview'));
  }
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  balancesForLocation(locationId: string): Observable<StockBalance[]> {
    return this.http.get<StockBalance[]>(this.apiUrl.path(`/stock/locations/${locationId}`));
  }

  movements(filter: MovementFilter): Observable<StockMovement[]> {
    let params = pageParams(filter);
    if (filter.productVariantId) {
      params = params.set('productVariantId', filter.productVariantId);
    }
    if (filter.locationId) {
      params = params.set('locationId', filter.locationId);
    }
    return this.http.get<StockMovement[]>(this.apiUrl.path('/stock/movements'), { params });
  }

  opening(request: OpeningStockRequest): Observable<unknown> {
    return this.http.post(this.apiUrl.path('/stock/opening'), request);
  }

  receive(request: ReceiveStockRequest): Observable<void> {
    return this.http.post<void>(this.apiUrl.path('/stock/receipts'), {
      ...request,
      note: null,
      referenceType: null,
      referenceId: null,
    });
  }

  /** Requires the Audit module on the backend. */
  adjust(request: AdjustStockRequest): Observable<void> {
    return this.http.post<void>(this.apiUrl.path('/stock/adjustments'), request);
  }

  policies(filter: PolicyFilter): Observable<InventoryPolicy[]> {
    let params = pageParams(filter);
    if (filter.locationId) {
      params = params.set('locationId', filter.locationId);
    }
    if (filter.belowReorderPoint !== null) {
      params = params.set('belowReorderPoint', String(filter.belowReorderPoint));
    }
    if (filter.outOfStock !== null) {
      params = params.set('outOfStock', String(filter.outOfStock));
    }
    return this.http.get<InventoryPolicy[]>(this.apiUrl.path('/stock/policies'), { params });
  }

  savePolicy(
    variantId: string,
    locationId: string,
    request: PolicyRequest,
  ): Observable<InventoryPolicy> {
    return this.http.put<InventoryPolicy>(
      this.apiUrl.path(`/stock/policies/${variantId}/${locationId}`),
      request,
    );
  }
}

export function pageParams(page: PageRequest): HttpParams {
  return new HttpParams().set('page', page.page).set('pageSize', page.pageSize);
}
