import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../../inventory/stock/data-access/stock-api.service';

export interface Supplier {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupplierRequest {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly notes: string | null;
}

export interface SupplierFilter extends PageRequest {
  readonly search: string | null;
  readonly isActive: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class SuppliersApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(filter: SupplierFilter): Observable<Supplier[]> {
    let params: HttpParams = pageParams(filter);
    if (filter.search) {
      params = params.set('search', filter.search);
    }
    if (filter.isActive !== null) {
      params = params.set('isActive', String(filter.isActive));
    }
    return this.http.get<Supplier[]>(this.apiUrl.path('/suppliers'), { params });
  }

  get(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(this.apiUrl.path(`/suppliers/${id}`));
  }

  create(request: SupplierRequest): Observable<Supplier> {
    return this.http.post<Supplier>(this.apiUrl.path('/suppliers'), request);
  }

  update(id: string, request: SupplierRequest): Observable<Supplier> {
    return this.http.put<Supplier>(this.apiUrl.path(`/suppliers/${id}`), request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/suppliers/${id}/deactivate`), null);
  }
}
