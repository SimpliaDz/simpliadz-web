import { TestBed } from '@angular/core/testing';
import { AppConfig, AppConfigService } from '../config/app-config.service';
import { ApiUrlService } from './api-url.service';

describe('ApiUrlService', () => {
  it('uses the current runtime API configuration', () => {
    const config: { value: AppConfig } = { value: { apiBaseUrl: '' } };

    TestBed.configureTestingModule({
      providers: [{ provide: AppConfigService, useValue: config }],
    });

    const service = TestBed.inject(ApiUrlService);
    expect(service.path('/auth/login')).toBe('/auth/login');

    config.value = { apiBaseUrl: '/api' };

    expect(service.path('/auth/login')).toBe('/api/auth/login');
    expect(service.isApiUrl('/api/auth/login')).toBe(true);
  });
});
