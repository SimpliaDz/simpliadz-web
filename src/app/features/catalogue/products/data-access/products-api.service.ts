import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface ProductVariantSummary {
  readonly id: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly color: string | null;
  readonly size: string | null;
  readonly retailPrice: number;
  readonly wholesalePrice: number | null;
  readonly isActive: boolean;
}

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly description: string | null;
  readonly brandId: string | null;
  readonly categoryId: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly variants: ProductVariantSummary[];
}

export interface ProductRequest {
  readonly name: string;
  readonly code: string | null;
  readonly description: string | null;
  readonly brandId: string | null;
  readonly categoryId: string | null;
}

export interface ProductFilter {
  readonly search: string | null;
  readonly isActive: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(filter: ProductFilter): Observable<Product[]> {
    let params = new HttpParams();
    if (filter.search) {
      params = params.set('search', filter.search);
    }
    if (filter.isActive !== null) {
      params = params.set('isActive', String(filter.isActive));
    }
    return this.http.get<Product[]>(this.apiUrl.path('/products'), { params });
  }

  get(id: string): Observable<Product> {
    return this.http.get<Product>(this.apiUrl.path(`/products/${id}`));
  }

  /** Returns only the new id; the caller reloads the product when it needs the full record. */
  create(request: ProductRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.apiUrl.path('/products'), request);
  }

  update(id: string, request: ProductRequest): Observable<Product> {
    return this.http.put<Product>(this.apiUrl.path(`/products/${id}`), request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/products/${id}/deactivate`), null);
  }

  activate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/products/${id}/activate`), null);
  }
}
