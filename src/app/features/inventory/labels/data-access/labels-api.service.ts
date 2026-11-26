import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

/** Raw entity returned by the API: all lengths in millimetres. */
export interface LabelTemplate {
  readonly id: string;
  readonly name: string;
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
  readonly labelWidthMm: number;
  readonly labelHeightMm: number;
  readonly marginMm: number;
  readonly gapMm: number;
  readonly showName: boolean;
  readonly showSku: boolean;
  readonly isActive: boolean;
}

export type LabelTemplateRequest = Omit<LabelTemplate, 'id' | 'isActive'>;

export interface LabelPrintLine {
  readonly variantId: string;
  readonly quantity: number;
}

@Injectable({ providedIn: 'root' })
export class LabelsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  templates(): Observable<LabelTemplate[]> {
    return this.http.get<LabelTemplate[]>(this.apiUrl.path('/barcode-label-templates'));
  }

  createTemplate(request: LabelTemplateRequest): Observable<unknown> {
    return this.http.post(this.apiUrl.path('/barcode-label-templates'), request);
  }

  activateTemplate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/barcode-label-templates/${id}/activate`), null);
  }

  updateTemplate(id: string, request: LabelTemplateRequest): Observable<unknown> {
    return this.http.put(this.apiUrl.path(`/barcode-label-templates/${id}`), request);
  }

  deactivateTemplate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/barcode-label-templates/${id}/deactivate`), null);
  }

  /** Returns printable HTML (SVG Code 128). Fails with 409 when a variant has no barcode. */
  printHtml(templateId: string, lines: LabelPrintLine[], showPrice: boolean, locale: string): Observable<string> {
    return this.http.post(
      this.apiUrl.path('/barcode-labels/print-document'),
      { templateId, lines, showPrice, locale },
      { responseType: 'text' },
    );
  }
}
