import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../core/api/api-url.service';

export interface Organization {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly currencyCode: string;
  readonly defaultLanguage: string | null;
  readonly isActive: boolean;
  readonly timeZoneId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OrganizationRequest {
  readonly name: string;
  readonly legalName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly currencyCode: string | null;
  readonly defaultLanguage: string | null;
  readonly isActive: boolean;
  readonly timeZoneId: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrganizationApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  /** Returns 404 until the organization has been saved for the first time. */
  get(): Observable<Organization> {
    return this.http.get<Organization>(this.apiUrl.path('/organization'));
  }

  save(request: OrganizationRequest): Observable<Organization> {
    return this.http.put<Organization>(this.apiUrl.path('/organization'), request);
  }
}
