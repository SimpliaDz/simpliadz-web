import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../core/api/api-url.service';

export interface LoyaltyProgram { readonly id: string; readonly name: string; readonly currencyCode: string; readonly spendAmountPerPoint: number; readonly isActive: boolean; }
export interface LoyaltyCard { readonly id: string; readonly customerId: string; readonly cardNumber: string; readonly pointsBalance: number; readonly isActive: boolean; readonly createdAt: string; }
export interface LoyaltyReward { readonly id: string; readonly name: string; readonly pointsCost: number; readonly isActive: boolean; }
export interface LoyaltyTransaction { readonly id: string; readonly cardId: string; readonly type: string; readonly pointsDelta: number; readonly sourceType: string; readonly sourceId: string; readonly occurredAt: string; readonly actorId: string; readonly rewardNameSnapshot: string | null; }

@Injectable({ providedIn: 'root' })
export class LoyaltyApiService {
  private readonly http = inject(HttpClient); private readonly apiUrl = inject(ApiUrlService);
  program(): Observable<LoyaltyProgram | null> { return this.http.get<LoyaltyProgram | null>(this.apiUrl.path('/crm/loyalty/program')); }
  configureProgram(request: { name: string; spendAmountPerPoint: number; isActive: boolean }): Observable<LoyaltyProgram> { return this.http.put<LoyaltyProgram>(this.apiUrl.path('/crm/loyalty/program'), request); }
  enroll(customerId: string): Observable<LoyaltyCard> { return this.http.post<LoyaltyCard>(this.apiUrl.path('/crm/loyalty/cards'), { customerId }); }
  downloadCard(customerId: string): Observable<Blob> {
    return this.http.get(this.apiUrl.path(`/crm/loyalty/customers/${customerId}/card/pdf`), { responseType: 'blob' });
  }
  previewCard(customerId: string): Observable<Blob> {
    return this.http.get(this.apiUrl.path(`/crm/loyalty/customers/${customerId}/card/svg`), { responseType: 'blob' });
  }
  emailCard(customerId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/crm/loyalty/customers/${customerId}/card/email`), {});
  }
  cardForCustomer(customerId: string): Observable<LoyaltyCard> { return this.http.get<LoyaltyCard>(this.apiUrl.path(`/crm/loyalty/customers/${customerId}/card`)); }
  cardByNumber(cardNumber: string): Observable<LoyaltyCard> { return this.http.get<LoyaltyCard>(this.apiUrl.path(`/crm/loyalty/cards/by-number/${encodeURIComponent(cardNumber)}`)); }
  setCardActive(cardId: string, isActive: boolean): Observable<LoyaltyCard> { return this.http.put<LoyaltyCard>(this.apiUrl.path(`/crm/loyalty/cards/${cardId}/active`), { isActive }); }
  history(cardId: string): Observable<LoyaltyTransaction[]> { return this.http.get<LoyaltyTransaction[]>(this.apiUrl.path(`/crm/loyalty/cards/${cardId}/transactions`), { params: new HttpParams().set('pageSize', '50') }); }
  rewards(): Observable<LoyaltyReward[]> { return this.http.get<LoyaltyReward[]>(this.apiUrl.path('/crm/loyalty/rewards')); }
  createReward(name: string, pointsCost: number): Observable<LoyaltyReward> { return this.http.post<LoyaltyReward>(this.apiUrl.path('/crm/loyalty/rewards'), { name, pointsCost }); }
}
