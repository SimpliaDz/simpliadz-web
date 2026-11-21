import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../core/config/app-config.service';
import { ReportsApiService } from './reports-api.service';

describe('ReportsApiService', () => {
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

  it('sends the ranking and paging parameters the product report requires', () => {
    const api = TestBed.inject(ReportsApiService);
    const http = TestBed.inject(HttpTestingController);

    api
      .productPerformance('2026-01-01', '2026-01-31', 'Revenue', { page: 2, pageSize: 50 })
      .subscribe();

    const request = http.expectOne((req) => req.url === '/api/reports/products/performance');
    expect(request.request.params.get('fromDate')).toBe('2026-01-01');
    expect(request.request.params.get('toDate')).toBe('2026-01-31');
    expect(request.request.params.get('rankBy')).toBe('Revenue');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('50');
    request.flush([]);
  });
});
