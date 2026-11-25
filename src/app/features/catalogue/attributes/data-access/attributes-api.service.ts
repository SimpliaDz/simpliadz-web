import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface AttributeValue {
  readonly id: string;
  readonly attributeId: string;
  readonly value: string;
  readonly displayOrder: number;
}

export interface Attribute {
  readonly id: string;
  readonly name: string;
  readonly values: AttributeValue[];
}

@Injectable({ providedIn: 'root' })
export class AttributesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(): Observable<Attribute[]> {
    return this.http.get<Attribute[]>(this.apiUrl.path('/attributes'));
  }

  get(id: string): Observable<Attribute> {
    return this.http.get<Attribute>(this.apiUrl.path(`/attributes/${id}`));
  }

  create(name: string): Observable<Attribute> {
    return this.http.post<Attribute>(this.apiUrl.path('/attributes'), { name });
  }

  addValue(attributeId: string, value: string, displayOrder: number): Observable<AttributeValue> {
    return this.http.post<AttributeValue>(this.apiUrl.path(`/attributes/${attributeId}/values`), {
      value,
      displayOrder,
    });
  }

  renameValue(attributeId: string, valueId: string, value: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/attributes/${attributeId}/values/${valueId}`), { value });
  }

  deleteValue(attributeId: string, valueId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl.path(`/attributes/${attributeId}/values/${valueId}`));
  }

  reorderValue(
    attributeId: string,
    valueId: string,
    displayOrder: number,
  ): Observable<AttributeValue> {
    return this.http.put<AttributeValue>(
      this.apiUrl.path(`/attributes/${attributeId}/values/${valueId}/order`),
      { displayOrder },
    );
  }
}
