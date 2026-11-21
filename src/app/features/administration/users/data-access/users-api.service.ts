import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface UserSummary {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly isActive: boolean;
  readonly emailConfirmed: boolean;
  readonly roles: string[];
}

export interface CreateUserRequest {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
  readonly roles: string[];
}

export interface UserPermissions {
  readonly userId: string;
  readonly permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.apiUrl.path('/users'));
  }

  get(id: string): Observable<UserSummary> {
    return this.http.get<UserSummary>(this.apiUrl.path(`/users/${id}`));
  }

  create(request: CreateUserRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.apiUrl.path('/users'), request);
  }

  assignRoles(id: string, roles: readonly string[]): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/users/${id}/roles`), { roles });
  }

  removeRoles(id: string, roles: readonly string[]): Observable<void> {
    return this.http.request<void>('DELETE', this.apiUrl.path(`/users/${id}/roles`), {
      body: { roles },
    });
  }

  /** Requires the Audit module on the backend. */
  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/users/${id}/deactivate`), null);
  }

  activate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/users/${id}/activate`), null);
  }

  effectivePermissions(id: string): Observable<UserPermissions> {
    return this.http.get<UserPermissions>(this.apiUrl.path(`/users/${id}/permissions`));
  }
}
