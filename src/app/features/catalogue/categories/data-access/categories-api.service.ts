import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';

export interface CategoryNode {
  readonly id: string;
  readonly name: string;
  readonly parentCategoryId: string | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
  readonly attributeIds: string[];
  readonly children: CategoryNode[];
}

export interface CategoryRequest {
  readonly name: string;
  readonly parentCategoryId: string | null;
  readonly attributeIds: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  /** Returns root categories with their full subtree. */
  tree(): Observable<CategoryNode[]> {
    return this.http.get<CategoryNode[]>(this.apiUrl.path('/categories'));
  }

  create(request: CategoryRequest): Observable<CategoryNode> {
    return this.http.post<CategoryNode>(this.apiUrl.path('/categories'), request);
  }

  update(id: string, request: CategoryRequest): Observable<CategoryNode> {
    return this.http.put<CategoryNode>(this.apiUrl.path(`/categories/${id}`), request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/categories/${id}/deactivate`), null);
  }
  activate(id: string): Observable<void> { return this.http.put<void>(this.apiUrl.path(`/categories/${id}/activate`), null); }
}
