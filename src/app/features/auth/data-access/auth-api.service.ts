import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../core/api/api-url.service';

export interface ForgotPasswordResponse {
  readonly resetToken: string;
}

export interface UpdateLanguageResponse {
  readonly languageCode: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(this.apiUrl.path('/auth/forgot-password'), {
      email,
    });
  }

  resetPassword(email: string, resetToken: string, newPassword: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path('/auth/reset-password'), {
      email,
      resetToken,
      newPassword,
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path('/auth/change-password'), {
      currentPassword,
      newPassword,
    });
  }

  updateLanguage(languageCode: string): Observable<UpdateLanguageResponse> {
    return this.http.put<UpdateLanguageResponse>(this.apiUrl.path('/auth/me/language'), {
      languageCode,
    });
  }
}
