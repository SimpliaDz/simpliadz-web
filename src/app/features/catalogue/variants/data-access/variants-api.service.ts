import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface VariantAttributeValue {
  readonly attributeValueId: string;
  readonly attributeId: string;
  readonly attributeName: string;
  readonly value: string;
  readonly displayOrder: number;
}

export interface Variant {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly isActive: boolean;
  readonly retailPrice: number;
  readonly wholesalePrice: number | null;
  readonly attributeValues: VariantAttributeValue[];
}

export interface CreateVariantRequest {
  readonly sku: string;
  readonly barcode: string | null;
  readonly retailPrice: number;
  readonly wholesalePrice: number | null;
  readonly attributeValueIds: readonly string[];
}

export interface VariantPrice {
  readonly priceListId: string;
  readonly productVariantId: string;
  readonly currencyCode: string;
  readonly price: number;
}

@Injectable({ providedIn: 'root' })
export class VariantsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  get(id: string): Observable<Variant> {
    return this.http.get<Variant>(this.apiUrl.path(`/variants/${id}`));
  }

  findBySku(sku: string): Observable<Variant> {
    return this.http.get<Variant>(this.apiUrl.path(`/variants/by-sku/${encodeURIComponent(sku)}`));
  }

  findByBarcode(barcode: string): Observable<Variant> {
    return this.http.get<Variant>(
      this.apiUrl.path(`/variants/by-barcode/${encodeURIComponent(barcode)}`),
    );
  }

  create(productId: string, request: CreateVariantRequest): Observable<Variant> {
    return this.http.post<Variant>(this.apiUrl.path(`/variants/products/${productId}`), request);
  }

  /** Requires the Audit module on the backend; the API returns 409 when it is disabled. */
  updateIdentifiers(id: string, sku: string, barcode: string | null, attributeValueIds: readonly string[]): Observable<Variant> {
    return this.http.put<Variant>(this.apiUrl.path(`/variants/${id}`), { sku, barcode, attributeValueIds });
  }

  generateBarcode(id: string): Observable<Variant> {
    return this.http.post<Variant>(this.apiUrl.path(`/variants/${id}/generate-barcode`), null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/variants/${id}/deactivate`), null);
  }

  /** Returns null when the variant has no price in the list (the API answers 404). */
  getPrice(priceListId: string, variantId: string): Observable<VariantPrice | null> {
    return this.http
      .get<VariantPrice>(this.apiUrl.path(`/price-lists/${priceListId}/variants/${variantId}`))
      .pipe(
        catchError((error: unknown) =>
          error instanceof Object && 'status' in error && error.status === 404
            ? of(null)
            : throwError(() => error),
        ),
      );
  }

  /** Requires the Audit module on the backend. */
  setPrice(priceListId: string, variantId: string, price: number): Observable<VariantPrice> {
    return this.http.put<VariantPrice>(
      this.apiUrl.path(`/price-lists/${priceListId}/variants/${variantId}`),
      { price },
    );
  }
}
