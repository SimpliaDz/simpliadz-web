import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiUrlService } from '../api/api-url.service';
import { CurrentUser, LoginRequest, LoginResponse } from './auth.models';

/**
 * The refresh token lives in sessionStorage so a page reload can restore the session.
 * The access token stays in memory only. sessionStorage is still readable by script
 * running in the page; see docs/TECHNICAL_GUIDE.md for the trade-off.
 */
const refreshTokenStorageKey = 'simpliadz.refreshToken';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly apiUrl = inject(ApiUrlService);
  private readonly http = inject(HttpClient);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly storage = inject(DOCUMENT).defaultView?.sessionStorage ?? null;
  private refreshToken: string | null = this.storage?.getItem(refreshTokenStorageKey) ?? null;
  private refreshInFlight$: Observable<void> | null = null;

  readonly accessToken = signal<string | null>(null);
  readonly user = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.accessToken() !== null && this.user() !== null);

  hasPermission(permission: string): boolean {
    return this.user()?.permissions.includes(permission) ?? false;
  }

  hasAllPermissions(permissions: readonly string[]): boolean {
    return permissions.every((permission) => this.hasPermission(permission));
  }

  login(request: LoginRequest): Observable<void> {
    return this.rawHttp.post<LoginResponse>(this.apiUrl.path('/auth/login'), request).pipe(
      tap((response) => this.applyTokens(response)),
      switchMap(() => this.loadCurrentUser()),
      map(() => undefined),
      catchError((error: unknown) => {
        this.clear();
        return throwError(() => error);
      }),
    );
  }

  /**
   * Re-establishes a session from the stored refresh token. Resolves to false when there is
   * nothing to restore or the refresh fails.
   */
  restore(): Observable<boolean> {
    if (this.isAuthenticated()) {
      return of(true);
    }

    if (!this.refreshToken) {
      return of(false);
    }

    return this.refresh().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  refresh(): Observable<void> {
    const token = this.refreshToken;

    if (!token) {
      return throwError(() => new Error('No refresh token is available.'));
    }

    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.rawHttp
        .post<LoginResponse>(this.apiUrl.path('/auth/refresh'), { refreshToken: token })
        .pipe(
          tap((response) => this.applyTokens(response)),
          switchMap(() => this.loadCurrentUser()),
          map(() => undefined),
          catchError((error: unknown) => {
            this.clear();
            return throwError(() => error);
          }),
          finalize(() => (this.refreshInFlight$ = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.refreshInFlight$;
  }

  logout(): Observable<void> {
    const token = this.refreshToken;
    this.clear();

    if (!token) {
      return EMPTY;
    }

    return this.rawHttp
      .post<void>(this.apiUrl.path('/auth/logout'), { refreshToken: token })
      .pipe(catchError(() => EMPTY));
  }

  clear(): void {
    this.accessToken.set(null);
    this.user.set(null);
    this.refreshInFlight$ = null;
    this.setRefreshToken(null);
  }

  private loadCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>(this.apiUrl.path('/auth/me'))
      .pipe(tap((user) => this.user.set(user)));
  }

  private applyTokens(response: LoginResponse): void {
    this.accessToken.set(response.accessToken);
    this.setRefreshToken(response.refreshToken);
  }

  private setRefreshToken(token: string | null): void {
    this.refreshToken = token;

    if (!this.storage) {
      return;
    }

    if (token) {
      this.storage.setItem(refreshTokenStorageKey, token);
    } else {
      this.storage.removeItem(refreshTokenStorageKey);
    }
  }
}
