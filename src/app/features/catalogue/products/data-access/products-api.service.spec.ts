import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../../core/config/app-config.service';
import { ProductsApiService } from './products-api.service';

describe('ProductsApiService', () => {
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

  it('sends only the filters that are set', () => {
    const api = TestBed.inject(ProductsApiService);
    const http = TestBed.inject(HttpTestingController);

    api.list({ search: 'shirt', isActive: null }).subscribe();

    const request = http.expectOne((req) => req.url === '/api/products');
    expect(request.request.params.get('search')).toBe('shirt');
    expect(request.request.params.has('isActive')).toBe(false);
    request.flush([]);
  });

  it('sends the active filter when it is chosen', () => {
    const api = TestBed.inject(ProductsApiService);
    const http = TestBed.inject(HttpTestingController);

    api.list({ search: null, isActive: false }).subscribe();

    const request = http.expectOne((req) => req.url === '/api/products');
    expect(request.request.params.get('isActive')).toBe('false');
    request.flush([]);
  });
});
