import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../inventory/stock/data-access/stock-api.service';

export interface WorkSession {
  readonly id: string;
  readonly userId: string;
  readonly clockInAt: string;
  readonly clockOutAt: string | null;
  readonly clockedOutBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkSessionCorrection {
  readonly id: string;
  readonly workSessionId: string;
  readonly oldClockInAt: string;
  readonly oldClockOutAt: string | null;
  readonly newClockInAt: string;
  readonly newClockOutAt: string | null;
  readonly reason: string;
  readonly correctedBy: string;
  readonly correctedAt: string;
}

export interface WorkHoursDay {
  readonly userId: string;
  readonly date: string;
  readonly hours: number;
}

export interface WorkHoursReport {
  readonly fromDate: string;
  readonly toDate: string;
  readonly timeZoneId: string;
  readonly totalHours: number;
  readonly days: WorkHoursDay[];
}

export interface SessionFilter extends PageRequest {
  readonly userId: string | null;
  readonly fromDate: string | null;
  readonly toDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkSessionsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  clockIn(): Observable<WorkSession> {
    return this.http.post<WorkSession>(this.apiUrl.path('/work-sessions/clock-in'), null);
  }

  clockOut(id: string): Observable<WorkSession> {
    return this.http.post<WorkSession>(this.apiUrl.path(`/work-sessions/${id}/clock-out`), null);
  }

  mine(
    fromDate: string | null,
    toDate: string | null,
    page: PageRequest,
  ): Observable<WorkSession[]> {
    let params: HttpParams = pageParams(page);
    if (fromDate) {
      params = params.set('fromDate', fromDate);
    }
    if (toDate) {
      params = params.set('toDate', toDate);
    }
    return this.http.get<WorkSession[]>(this.apiUrl.path('/work-sessions/me'), { params });
  }

  list(filter: SessionFilter): Observable<WorkSession[]> {
    let params: HttpParams = pageParams(filter);
    if (filter.userId) {
      params = params.set('userId', filter.userId);
    }
    if (filter.fromDate) {
      params = params.set('fromDate', filter.fromDate);
    }
    if (filter.toDate) {
      params = params.set('toDate', filter.toDate);
    }
    return this.http.get<WorkSession[]>(this.apiUrl.path('/work-sessions'), { params });
  }

  /** Requires the Audit module. A reason is mandatory and the old values are kept as a correction. */
  correct(
    id: string,
    clockInAt: string,
    clockOutAt: string | null,
    reason: string,
  ): Observable<WorkSession> {
    return this.http.put<WorkSession>(this.apiUrl.path(`/work-sessions/${id}`), {
      clockInAt,
      clockOutAt,
      reason,
    });
  }

  corrections(id: string): Observable<WorkSessionCorrection[]> {
    return this.http.get<WorkSessionCorrection[]>(
      this.apiUrl.path(`/work-sessions/${id}/corrections`),
    );
  }

  report(fromDate: string, toDate: string, userId: string | null): Observable<WorkHoursReport> {
    let params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    if (userId) {
      params = params.set('userId', userId);
    }
    return this.http.get<WorkHoursReport>(this.apiUrl.path('/reports/work-hours'), { params });
  }
}
