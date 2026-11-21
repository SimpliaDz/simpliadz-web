import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../stock/data-access/stock-api.service';

export type TransferStatus = 'Draft' | 'Completed' | 'Cancelled';

export interface StockTransferLine {
  readonly id: string;
  readonly productVariantId: string;
  readonly quantity: number;
}

export interface StockTransfer {
  readonly id: string;
  readonly transferNumber: string;
  readonly sourceLocationId: string;
  readonly destinationLocationId: string;
  readonly status: TransferStatus;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly completedAt: string | null;
  readonly completedBy: string | null;
  readonly lines: StockTransferLine[];
}

@Injectable({ providedIn: 'root' })
export class TransfersApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(page: PageRequest): Observable<StockTransfer[]> {
    return this.http.get<StockTransfer[]>(this.apiUrl.path('/stock-transfers'), {
      params: pageParams(page),
    });
  }

  get(id: string): Observable<StockTransfer> {
    return this.http.get<StockTransfer>(this.apiUrl.path(`/stock-transfers/${id}`));
  }

  create(sourceLocationId: string, destinationLocationId: string): Observable<StockTransfer> {
    return this.http.post<StockTransfer>(this.apiUrl.path('/stock-transfers'), {
      sourceLocationId,
      destinationLocationId,
    });
  }

  addLine(id: string, productVariantId: string, quantity: number): Observable<StockTransfer> {
    return this.http.post<StockTransfer>(this.apiUrl.path(`/stock-transfers/${id}/lines`), {
      productVariantId,
      quantity,
    });
  }

  /** Moves stock atomically. Returns 409 InsufficientStock when any line is short. */
  complete(id: string): Observable<StockTransfer> {
    return this.http.post<StockTransfer>(this.apiUrl.path(`/stock-transfers/${id}/complete`), null);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/stock-transfers/${id}/cancel`), null);
  }
}
