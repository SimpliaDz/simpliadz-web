import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../../core/config/app-config.service';
import { VariantsApiService } from './variants-api.service';

describe('VariantsApiService', () => {
  function setup(): { api: VariantsApiService; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { value: { apiBaseUrl: '/api' } } },
      ],
    });
    return { api: TestBed.inject(VariantsApiService), http: TestBed.inject(HttpTestingController) };
  }

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('returns null when a variant has no price in the list', () => {
    const { api, http } = setup();
    let price: unknown = 'unset';

    api.getPrice('list-1', 'variant-1').subscribe((value) => (price = value));

    http
      .expectOne('/api/price-lists/list-1/variants/variant-1')
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(price).toBeNull();
  });

  it('returns the price when one is set', () => {
    const { api, http } = setup();
    let price: unknown = null;

    api.getPrice('list-1', 'variant-1').subscribe((value) => (price = value));

    http.expectOne('/api/price-lists/list-1/variants/variant-1').flush({
      priceListId: 'list-1',
      productVariantId: 'variant-1',
      currencyCode: 'DZD',
      price: 1200,
    });

    expect(price).toEqual(expect.objectContaining({ price: 1200, currencyCode: 'DZD' }));
  });

  it('sends the attribute value ids a new variant needs', () => {
    const { api, http } = setup();

    api
      .create('product-1', {
        sku: 'TSHIRT-M-BLK',
        barcode: null,
        retailPrice: 1500,
        wholesalePrice: null,
        attributeValueIds: ['v-size-m', 'v-color-black'],
      })
      .subscribe();

    const request = http.expectOne('/api/variants/products/product-1');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.attributeValueIds).toEqual(['v-size-m', 'v-color-black']);
    request.flush({});
  });
});
