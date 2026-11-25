import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export type LocationType = 'Store' | 'Warehouse';

export interface Location {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly type: LocationType;
  readonly address: string | null;
  readonly phone: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocationRequest {
  readonly name: string;
  readonly code: string | null;
  readonly type: LocationType;
  readonly address: string | null;
  readonly phone: string | null;
}

@Injectable({ providedIn: 'root' })
export class LocationsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(): Observable<Location[]> {
    return this.http.get<Location[]>(this.apiUrl.path('/locations'));
  }

  get(id: string): Observable<Location> {
    return this.http.get<Location>(this.apiUrl.path(`/locations/${id}`));
  }

  create(request: LocationRequest): Observable<Location> {
    return this.http.post<Location>(this.apiUrl.path('/locations'), request);
  }

  update(id: string, request: LocationRequest): Observable<Location> {
    return this.http.put<Location>(this.apiUrl.path(`/locations/${id}`), request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/locations/${id}/deactivate`), null);
  }

  activate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/locations/${id}/activate`), null);
  }
}
