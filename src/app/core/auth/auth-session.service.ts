import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  catchError,
  finalize,
  map,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiUrlService } from '../api/api-url.service';
import { CurrentUser, LoginRequest, LoginResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly apiUrl = inject(ApiUrlService);
  private readonly http = inject(HttpClient);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private refreshToken: string | null = null;
  private refreshInFlight$: Observable<void> | null = null;

  readonly accessToken = signal<string | null>(null);
  readonly user = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.accessToken() !== null && this.user() !== null);

  login(request: LoginRequest): Observable<void> {
    return this.rawHttp.post<LoginResponse>(this.apiUrl.path('/auth/login'), request).pipe(
      tap((response) => this.applyTokens(response)),
      switchMap(() => this.loadCurrentUser()),
      map(() => undefined),
    );
  }

  refresh(): Observable<void> {
    if (!this.refreshToken) {
      return throwError(() => new Error('No refresh token is available.'));
    }

    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.rawHttp
        .post<LoginResponse>(this.apiUrl.path('/auth/refresh'), { refreshToken: this.refreshToken })
        .pipe(
          tap((response) => this.applyTokens(response)),
          switchMap(() => this.loadCurrentUser()),
          map(() => undefined),
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
    this.refreshToken = null;
    this.refreshInFlight$ = null;
  }

  private loadCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>(this.apiUrl.path('/auth/me'))
      .pipe(tap((user) => this.user.set(user)));
  }

  private applyTokens(response: LoginResponse): void {
    this.accessToken.set(response.accessToken);
    this.refreshToken = response.refreshToken;
  }
}
