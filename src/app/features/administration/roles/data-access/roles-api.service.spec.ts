import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../../core/config/app-config.service';
import { RolesApiService } from './roles-api.service';

describe('RolesApiService', () => {
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

  it('removes permissions with a DELETE that carries the names in the body', () => {
    const api = TestBed.inject(RolesApiService);
    const http = TestBed.inject(HttpTestingController);

    api.removePermissions('role-1', ['users.view']).subscribe();

    const request = http.expectOne('/api/roles/role-1/permissions');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ permissions: ['users.view'] });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('adds permissions with a POST of the names', () => {
    const api = TestBed.inject(RolesApiService);
    const http = TestBed.inject(HttpTestingController);

    api.addPermissions('role-1', ['brands.view', 'brands.create']).subscribe();

    const request = http.expectOne('/api/roles/role-1/permissions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ permissions: ['brands.view', 'brands.create'] });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
