import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class BrandsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  list(): Observable<Brand[]> {
    return this.http.get<Brand[]>(this.apiUrl.path('/brands'));
  }

  create(name: string): Observable<Brand> {
    return this.http.post<Brand>(this.apiUrl.path('/brands'), { name });
  }

  update(id: string, name: string): Observable<Brand> {
    return this.http.put<Brand>(this.apiUrl.path(`/brands/${id}`), { name });
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/brands/${id}/deactivate`), null);
  }
}
