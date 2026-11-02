import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiUrlService } from '../api-url.service';
import { AuthSessionService } from '../../auth/auth-session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = inject(ApiUrlService);
  const accessToken = inject(AuthSessionService).accessToken();

  if (!accessToken || !apiUrl.isApiUrl(request.url) || request.url.includes('/auth/refresh')) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
};
