import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../../core/config/app-config.service';
import { PurchaseOrdersApiService } from './purchase-orders-api.service';

describe('PurchaseOrdersApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { value: { apiBaseUrl: '/api' } } },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the same client-generated receipt id so a retry is refused as a duplicate', () => {
    const api = TestBed.inject(PurchaseOrdersApiService);
    const http = TestBed.inject(HttpTestingController);
    const receiptId = '3f2c9a1e-0000-4000-8000-000000000001';

    api
      .receive(receiptId, 'po-1', [{ purchaseOrderLineId: 'line-1', quantityReceived: 4 }], 'Delivery #70')
      .subscribe();

    const request = http.expectOne('/api/goods-receipts');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      id: receiptId,
      purchaseOrderId: 'po-1',
      lines: [{ purchaseOrderLineId: 'line-1', quantityReceived: 4 }],
      deliveryReference: 'Delivery #70',
    });
    request.flush({});
  });
});
