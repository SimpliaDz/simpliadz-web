import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../config/app-config.service';
import { AuthSessionService } from './auth-session.service';

const storageKey = 'simpliadz.refreshToken';

const loginResponse = {
  accessToken: 'access-1',
  expiresMinutes: 60,
  accessTokenExpiresAtUtc: '2026-11-21T10:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAtUtc: '2026-12-05T10:00:00Z',
  email: 'admin@dev.local',
  roles: ['Admin'],
};

const currentUser = {
  userId: '00000000-0000-0000-0000-0000000000aa',
  email: 'admin@dev.local',
  roles: ['Admin'],
  permissions: ['products.view'],
};

function setup(): { service: AuthSessionService; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AppConfigService, useValue: { value: { apiBaseUrl: '/api' } } },
    ],
  });
  return {
    service: TestBed.inject(AuthSessionService),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('AuthSessionService', () => {
  beforeEach(() => sessionStorage.clear());

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('stores the refresh token and loads the current user after login', () => {
    const { service, http } = setup();

    service.login({ email: 'admin@dev.local', password: 'secret' }).subscribe();

    http.expectOne('/api/auth/login').flush(loginResponse);
    http.expectOne('/api/auth/me').flush(currentUser);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.hasPermission('products.view')).toBe(true);
    expect(service.hasPermission('users.view')).toBe(false);
    expect(sessionStorage.getItem(storageKey)).toBe('refresh-1');
  });

  it('clears the half-established session when loading the user fails after login', () => {
    const { service, http } = setup();
    let failed = false;

    service.login({ email: 'admin@dev.local', password: 'secret' }).subscribe({
      error: () => (failed = true),
    });

    http.expectOne('/api/auth/login').flush(loginResponse);
    http.expectOne('/api/auth/me').flush(null, { status: 500, statusText: 'Server Error' });

    expect(failed).toBe(true);
    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('restores a session after reload using the stored refresh token', () => {
    sessionStorage.setItem(storageKey, 'stored-refresh');
    const { service, http } = setup();
    let restored: boolean | undefined;

    service.restore().subscribe((value) => (restored = value));

    const refreshRequest = http.expectOne('/api/auth/refresh');
    expect(refreshRequest.request.body).toEqual({ refreshToken: 'stored-refresh' });
    refreshRequest.flush({ ...loginResponse, refreshToken: 'rotated-refresh' });
    http.expectOne('/api/auth/me').flush(currentUser);

    expect(restored).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(sessionStorage.getItem(storageKey)).toBe('rotated-refresh');
  });

  it('reports nothing to restore without a stored refresh token', () => {
    const { service, http } = setup();
    let restored: boolean | undefined;

    service.restore().subscribe((value) => (restored = value));

    expect(restored).toBe(false);
    http.expectNone('/api/auth/refresh');
  });

  it('reports a failed restore as signed out and forgets the stored token', () => {
    sessionStorage.setItem(storageKey, 'expired-refresh');
    const { service, http } = setup();
    let restored: boolean | undefined;

    service.restore().subscribe((value) => (restored = value));
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(restored).toBe(false);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('revokes the refresh token on logout and clears local state', () => {
    sessionStorage.setItem(storageKey, 'refresh-1');
    const { service, http } = setup();
    service.restore().subscribe();
    http.expectOne('/api/auth/refresh').flush(loginResponse);
    http.expectOne('/api/auth/me').flush(currentUser);

    service.logout().subscribe();

    const logoutRequest = http.expectOne('/api/auth/logout');
    expect(logoutRequest.request.body).toEqual({ refreshToken: 'refresh-1' });
    logoutRequest.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });
});
