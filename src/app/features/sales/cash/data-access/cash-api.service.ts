import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../../inventory/stock/data-access/stock-api.service';

export interface CashRegister {
  readonly id: string;
  readonly locationId: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface CashRegisterRequest {
  readonly locationId: string;
  readonly code: string;
  readonly name: string;
}

export type CashSessionStatus = 'Open' | 'Closed';

export interface CashSession {
  readonly id: string;
  readonly cashRegisterId: string;
  readonly locationId: string;
  readonly status: CashSessionStatus;
  readonly openedBy: string;
  readonly openedAt: string;
  readonly openingCash: number;
  readonly cashPayments: number;
  readonly otherPayments: number;
  readonly cashMovements: number;
  readonly expectedCash: number;
  readonly countedCash: number | null;
  readonly difference: number | null;
  readonly closedBy: string | null;
  readonly closedAt: string | null;
}

export interface CashMovement {
  readonly id: string;
  readonly cashSessionId: string;
  readonly amountDelta: number;
  readonly reason: string;
  readonly createdBy: string;
  readonly occurredAt: string;
}

@Injectable({ providedIn: 'root' })
export class CashApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  registers(locationId: string | null): Observable<CashRegister[]> {
    let params = new HttpParams();
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http.get<CashRegister[]>(this.apiUrl.path('/cash-registers'), { params });
  }

  createRegister(request: CashRegisterRequest): Observable<CashRegister> {
    return this.http.post<CashRegister>(this.apiUrl.path('/cash-registers'), request);
  }

  updateRegister(id: string, code: string, name: string): Observable<CashRegister> {
    return this.http.put<CashRegister>(this.apiUrl.path(`/cash-registers/${id}`), { code, name });
  }

  deactivateRegister(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/cash-registers/${id}/deactivate`), null);
  }

  sessions(locationId: string | null, page: PageRequest): Observable<CashSession[]> {
    let params: HttpParams = pageParams(page);
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http.get<CashSession[]>(this.apiUrl.path('/cash-sessions'), { params });
  }

  /** Open sessions at a location. The backend requires a location. */
  openSessions(locationId: string): Observable<CashSession[]> {
    return this.http.get<CashSession[]>(this.apiUrl.path('/cash-sessions/current'), {
      params: new HttpParams().set('locationId', locationId),
    });
  }

  session(id: string): Observable<CashSession> {
    return this.http.get<CashSession>(this.apiUrl.path(`/cash-sessions/${id}`));
  }

  /** Requires the Audit module. */
  open(cashRegisterId: string, openingCash: number): Observable<CashSession> {
    return this.http.post<CashSession>(this.apiUrl.path('/cash-sessions/open'), {
      cashRegisterId,
      openingCash,
    });
  }

  /** Requires the Audit module. The counted cash is compared with the expected cash. */
  close(id: string, countedCash: number): Observable<CashSession> {
    return this.http.post<CashSession>(this.apiUrl.path(`/cash-sessions/${id}/close`), {
      countedCash,
    });
  }

  movements(id: string): Observable<CashMovement[]> {
    return this.http.get<CashMovement[]>(this.apiUrl.path(`/cash-sessions/${id}/movements`));
  }

  /** Requires the Audit module. A negative amount takes cash out of the drawer. */
  addMovement(id: string, amountDelta: number, reason: string): Observable<CashMovement> {
    return this.http.post<CashMovement>(this.apiUrl.path(`/cash-sessions/${id}/movements`), {
      amountDelta,
      reason,
    });
  }
}
