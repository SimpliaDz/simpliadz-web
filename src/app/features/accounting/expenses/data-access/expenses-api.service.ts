import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageRequest, pageParams } from '../../../inventory/stock/data-access/stock-api.service';

export interface ExpenseCategory {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Expense {
  readonly id: string;
  readonly expenseCategoryId: string;
  readonly locationId: string | null;
  readonly amount: number;
  readonly expenseDate: string;
  readonly description: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExpenseRequest {
  readonly expenseCategoryId: string;
  readonly locationId: string | null;
  readonly amount: number;
  readonly expenseDate: string;
  readonly description: string | null;
}

export interface ExpenseFilter extends PageRequest {
  readonly fromDate: string | null;
  readonly toDate: string | null;
  readonly expenseCategoryId: string | null;
  readonly locationId: string | null;
}

@Injectable({ providedIn: 'root' })
export class ExpensesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  categories(isActive: boolean | null): Observable<ExpenseCategory[]> {
    let params = new HttpParams();
    if (isActive !== null) {
      params = params.set('isActive', String(isActive));
    }
    return this.http.get<ExpenseCategory[]>(this.apiUrl.path('/expense-categories'), { params });
  }

  createCategory(name: string): Observable<ExpenseCategory> {
    return this.http.post<ExpenseCategory>(this.apiUrl.path('/expense-categories'), { name });
  }

  updateCategory(id: string, name: string): Observable<ExpenseCategory> {
    return this.http.put<ExpenseCategory>(this.apiUrl.path(`/expense-categories/${id}`), { name });
  }

  deactivateCategory(id: string): Observable<void> {
    return this.http.put<void>(this.apiUrl.path(`/expense-categories/${id}/deactivate`), null);
  }

  list(filter: ExpenseFilter): Observable<Expense[]> {
    let params: HttpParams = pageParams(filter);
    if (filter.fromDate) {
      params = params.set('fromDate', filter.fromDate);
    }
    if (filter.toDate) {
      params = params.set('toDate', filter.toDate);
    }
    if (filter.expenseCategoryId) {
      params = params.set('expenseCategoryId', filter.expenseCategoryId);
    }
    if (filter.locationId) {
      params = params.set('locationId', filter.locationId);
    }
    return this.http.get<Expense[]>(this.apiUrl.path('/expenses'), { params });
  }

  create(request: ExpenseRequest): Observable<Expense> {
    return this.http.post<Expense>(this.apiUrl.path('/expenses'), request);
  }

  /** Full replacement of the expense. */
  update(id: string, request: ExpenseRequest): Observable<Expense> {
    return this.http.put<Expense>(this.apiUrl.path(`/expenses/${id}`), request);
  }
}
