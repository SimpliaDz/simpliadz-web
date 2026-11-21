import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../stock/data-access/stock-api.service';

export type WarningKind = 'LowStock' | 'Ageing';

export interface WarningSettings {
  readonly enabled: boolean;
  readonly lowStockEnabled: boolean;
  readonly ageingEnabled: boolean;
  readonly intervalMinutes: number;
  readonly ageThresholdDays: number;
  readonly lastRunAt: string | null;
  readonly nextRunAt: string;
}

export interface StockWarning {
  readonly id: string;
  readonly kind: WarningKind;
  readonly productVariantId: string;
  readonly sku: string;
  readonly productName: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly quantityOnHand: number;
  readonly reorderPoint: number | null;
  readonly stockEnteredAt: string | null;
  readonly isActive: boolean;
  readonly firstDetectedAt: string;
  readonly lastDetectedAt: string;
  readonly resolvedAt: string | null;
}

export interface WarningFilter extends PageRequest {
  readonly locationId: string | null;
  readonly kind: WarningKind | null;
  readonly activeOnly: boolean;
}

@Injectable({ providedIn: 'root' })
export class WarningsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  settings(): Observable<WarningSettings> {
    return this.http.get<WarningSettings>(this.apiUrl.path('/inventory-warnings/settings'));
  }

  saveSettings(
    settings: Omit<WarningSettings, 'lastRunAt' | 'nextRunAt'>,
  ): Observable<WarningSettings> {
    return this.http.put<WarningSettings>(
      this.apiUrl.path('/inventory-warnings/settings'),
      settings,
    );
  }

  /** Runs a scan now, even when the schedule is disabled. 409 when a scan is already running. */
  runNow(): Observable<{ ran: boolean }> {
    return this.http.post<{ ran: boolean }>(this.apiUrl.path('/inventory-warnings/run'), null);
  }

  list(filter: WarningFilter): Observable<StockWarning[]> {
    let params: HttpParams = pageParams(filter).set('activeOnly', String(filter.activeOnly));
    if (filter.locationId) {
      params = params.set('locationId', filter.locationId);
    }
    if (filter.kind) {
      params = params.set('kind', filter.kind);
    }
    return this.http.get<StockWarning[]>(this.apiUrl.path('/inventory-warnings'), { params });
  }
}
