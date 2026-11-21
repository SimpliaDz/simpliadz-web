import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../stock/data-access/stock-api.service';

export type CountStatus = 'Draft' | 'Completed' | 'Cancelled';

export interface InventoryCountLine {
  readonly id: string;
  readonly productVariantId: string;
  readonly expectedQuantity: number;
  readonly countedQuantity: number | null;
  readonly difference: number | null;
}

export interface InventoryCount {
  readonly id: string;
  readonly locationId: string;
  readonly status: CountStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly createdBy: string;
  readonly completedBy: string | null;
  readonly lines: InventoryCountLine[];
}

@Injectable({ providedIn: 'root' })
export class CountsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(locationId: string | null, page: PageRequest): Observable<InventoryCount[]> {
    let params: HttpParams = pageParams(page);
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http.get<InventoryCount[]>(this.apiUrl.path('/inventory-counts'), { params });
  }

  get(id: string): Observable<InventoryCount> {
    return this.http.get<InventoryCount>(this.apiUrl.path(`/inventory-counts/${id}`));
  }

  /** Captures the current balances at the location as the expected quantities. */
  start(locationId: string): Observable<InventoryCount> {
    return this.http.post<InventoryCount>(this.apiUrl.path('/inventory-counts'), { locationId });
  }

  addLine(id: string, productVariantId: string): Observable<InventoryCount> {
    return this.http.post<InventoryCount>(this.apiUrl.path(`/inventory-counts/${id}/lines`), {
      productVariantId,
    });
  }

  setCounted(
    id: string,
    productVariantId: string,
    countedQuantity: number,
  ): Observable<InventoryCount> {
    return this.http.put<InventoryCount>(
      this.apiUrl.path(`/inventory-counts/${id}/lines/${productVariantId}/count`),
      { countedQuantity },
    );
  }

  /** Requires the Audit module. Fails with 409 if stock moved since the count started. */
  complete(id: string): Observable<InventoryCount> {
    return this.http.post<InventoryCount>(
      this.apiUrl.path(`/inventory-counts/${id}/complete`),
      null,
    );
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/inventory-counts/${id}/cancel`), null);
  }
}
