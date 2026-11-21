import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../../inventory/stock/data-access/stock-api.service';

export type CustomerType = 'Retail' | 'Wholesale';

export interface Customer {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly customerType: CustomerType;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerRequest {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  /** Blank means Retail on the backend. */
  readonly customerType: CustomerType;
  readonly notes: string | null;
}

export interface CustomerFilter extends PageRequest {
  readonly search: string | null;
  readonly customerType: CustomerType | null;
  readonly isActive: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(filter: CustomerFilter): Observable<Customer[]> {
    let params: HttpParams = pageParams(filter);
    if (filter.search) {
      params = params.set('search', filter.search);
    }
    if (filter.customerType) {
      params = params.set('customerType', filter.customerType);
    }
    if (filter.isActive !== null) {
      params = params.set('isActive', String(filter.isActive));
    }
    return this.http.get<Customer[]>(this.apiUrl.path('/customers'), { params });
  }

  get(id: string): Observable<Customer> {
    return this.http.get<Customer>(this.apiUrl.path(`/customers/${id}`));
  }

  create(request: CustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(this.apiUrl.path('/customers'), request);
  }

  update(id: string, request: CustomerRequest): Observable<Customer> {
    return this.http.put<Customer>(this.apiUrl.path(`/customers/${id}`), request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/customers/${id}/deactivate`), null);
  }
}
