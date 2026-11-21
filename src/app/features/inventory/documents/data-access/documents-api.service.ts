import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export type DocumentType = 'StockList' | 'CountSheet' | 'CountDifferences';
export type PaperSize = 'A4' | 'A3';

/** Stock list columns for each document type, in the order the backend accepts them. */
export const documentColumns: Record<DocumentType, readonly string[]> = {
  StockList: ['Product', 'Sku', 'Barcode', 'Quantity'],
  CountSheet: ['Product', 'Sku', 'Barcode', 'Expected', 'Counted'],
  CountDifferences: ['Product', 'Sku', 'Barcode', 'Expected', 'Counted', 'Difference'],
};

/** The API returns the type as a number (1, 2, 3) and the columns as a comma-separated string. */
export interface DocumentTemplate {
  readonly id: string;
  readonly name: string;
  readonly type: number;
  readonly title: string;
  readonly columns: string;
  readonly paperSize: PaperSize;
  readonly landscape: boolean;
  readonly footerText: string | null;
  readonly isActive: boolean;
}

export const documentTypeFromNumber: Record<number, DocumentType> = {
  1: 'StockList',
  2: 'CountSheet',
  3: 'CountDifferences',
};

export interface DocumentTemplateRequest {
  readonly name: string;
  readonly type: DocumentType;
  readonly title: string;
  readonly columns: readonly string[];
  readonly paperSize: PaperSize;
  readonly landscape: boolean;
  readonly footerText: string | null;
}

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  templates(): Observable<DocumentTemplate[]> {
    return this.http.get<DocumentTemplate[]>(this.apiUrl.path('/inventory-document-templates'));
  }

  createTemplate(request: DocumentTemplateRequest): Observable<unknown> {
    return this.http.post(this.apiUrl.path('/inventory-document-templates'), request);
  }

  /** The type cannot change after creation, so the update body omits it. */
  updateTemplate(id: string, request: Omit<DocumentTemplateRequest, 'type'>): Observable<unknown> {
    return this.http.put(this.apiUrl.path(`/inventory-document-templates/${id}`), request);
  }

  deactivateTemplate(id: string): Observable<void> {
    return this.http.put<void>(
      this.apiUrl.path(`/inventory-document-templates/${id}/deactivate`),
      null,
    );
  }

  /** Returns the printable HTML for a stock list. */
  stockListHtml(
    templateId: string,
    locationId: string | null,
    includeZeroStock: boolean,
  ): Observable<string> {
    let params = new HttpParams()
      .set('templateId', templateId)
      .set('includeZeroStock', String(includeZeroStock));
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http.get(this.apiUrl.path('/reports/inventory/document'), {
      params,
      responseType: 'text',
    });
  }

  countSheetHtml(countId: string, templateId: string): Observable<string> {
    return this.http.get(this.apiUrl.path(`/inventory-counts/${countId}/count-sheet`), {
      params: new HttpParams().set('templateId', templateId),
      responseType: 'text',
    });
  }

  /** The count must be completed before its differences can be printed. */
  differenceHtml(countId: string, templateId: string): Observable<string> {
    return this.http.get(this.apiUrl.path(`/inventory-counts/${countId}/difference-document`), {
      params: new HttpParams().set('templateId', templateId),
      responseType: 'text',
    });
  }
}
