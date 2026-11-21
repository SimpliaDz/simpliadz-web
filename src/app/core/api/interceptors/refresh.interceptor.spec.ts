import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AppConfigService } from '../../config/app-config.service';
import { refreshInterceptor } from './refresh.interceptor';

describe('refreshInterceptor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AppConfigService, useValue: { value: { apiBaseUrl: '/api' } } },
      ],
    });
  });

  it('sends the user to sign in when a 401 cannot be refreshed', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    let failed = false;

    http.get('/api/products').subscribe({ error: () => (failed = true) });
    backend.expectOne('/api/products').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: router.url } });
    backend.verify();
  });
});
