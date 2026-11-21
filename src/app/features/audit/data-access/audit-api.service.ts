import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../core/api/api-url.service';

export interface AuditEntry {
  readonly id: string;
  readonly userId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly oldValues: string | null;
  readonly newValues: string | null;
  readonly timestamp: string;
  readonly correlationId: string | null;
}

export interface AuditHistory {
  readonly totalItems: number;
  readonly items: AuditEntry[];
}

export interface AuditFilter {
  readonly userId: string | null;
  readonly action: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  entries(filter: AuditFilter): Observable<AuditHistory> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    const optional: [string, string | null][] = [
      ['userId', filter.userId],
      ['action', filter.action],
      ['entityType', filter.entityType],
      ['entityId', filter.entityId],
      ['from', filter.from],
      ['to', filter.to],
    ];
    for (const [key, value] of optional) {
      if (value) {
        params = params.set(key, value);
      }
    }
    return this.http.get<AuditHistory>(this.apiUrl.path('/audit/entries'), { params });
  }
}
