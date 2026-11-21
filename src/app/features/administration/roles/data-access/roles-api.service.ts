import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface RoleSummary {
  readonly id: string;
  readonly name: string;
}

export interface RoleDetail {
  readonly id: string;
  readonly name: string;
  readonly permissions: string[];
}

export interface PermissionDefinition {
  readonly name: string;
  readonly displayName: string;
  readonly category: string;
}

@Injectable({ providedIn: 'root' })
export class RolesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(): Observable<RoleSummary[]> {
    return this.http.get<RoleSummary[]>(this.apiUrl.path('/roles'));
  }

  get(id: string): Observable<RoleDetail> {
    return this.http.get<RoleDetail>(this.apiUrl.path(`/roles/${id}`));
  }

  create(name: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.apiUrl.path('/roles'), { name });
  }

  addPermissions(id: string, permissions: readonly string[]): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/roles/${id}/permissions`), { permissions });
  }

  removePermissions(id: string, permissions: readonly string[]): Observable<void> {
    return this.http.request<void>('DELETE', this.apiUrl.path(`/roles/${id}/permissions`), {
      body: { permissions },
    });
  }

  permissionCatalogue(): Observable<PermissionDefinition[]> {
    return this.http.get<PermissionDefinition[]>(this.apiUrl.path('/permissions'));
  }
}
