import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProductsApiService } from '../../../catalogue/products/data-access/products-api.service';

/** A sellable/stockable unit with the product context needed to display it. */
export interface VariantOption {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly sku: string;
  readonly barcode?: string | null;
  readonly label: string;
  readonly isActive: boolean;
}

export function matchesVariant(variant: VariantOption, search: string): boolean {
  const text = [variant.label, variant.barcode].filter(Boolean).join(' ').toLowerCase();
  return search.trim().toLowerCase().split(/\s+/).every(term => text.includes(term));
}

/** Stock is held per variant. The product list carries every variant, so one call resolves names. */
@Injectable({ providedIn: 'root' })
export class VariantCatalogueService {
  private readonly products = inject(ProductsApiService);

  options(): Observable<VariantOption[]> {
    return this.products.list({ search: null, isActive: null }).pipe(
      map((products) =>
        products.flatMap((product) =>
          product.variants.map((variant) => {
            const detail = [variant.color, variant.size].filter(Boolean).join(' / ');
            return {
              id: variant.id,
              productId: product.id,
              productName: product.name,
              sku: variant.sku,
              barcode: variant.barcode,
              label: `${product.name}${detail ? ` (${detail})` : ''} · ${variant.sku}`,
              isActive: variant.isActive,
            };
          }),
        ),
      ),
    );
  }
}
