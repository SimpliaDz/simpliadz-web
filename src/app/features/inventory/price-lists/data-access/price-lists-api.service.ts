import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export type PriceListType = 'Retail' | 'Wholesale';

export interface PriceList {
  readonly id: string;
  readonly name: string;
  readonly currencyCode: string;
  readonly type: PriceListType;
  readonly isActive: boolean;
}

export interface CreatePriceListRequest {
  readonly name: string;
  readonly currencyCode: string;
  readonly type: PriceListType;
}

@Injectable({ providedIn: 'root' })
export class PriceListsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(): Observable<PriceList[]> {
    return this.http.get<PriceList[]>(this.apiUrl.path('/price-lists'));
  }

  create(request: CreatePriceListRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.apiUrl.path('/price-lists'), request);
  }
}
