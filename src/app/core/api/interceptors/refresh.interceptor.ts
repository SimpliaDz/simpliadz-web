import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthSessionService } from '../../auth/auth-session.service';
import { ApiUrlService } from '../api-url.service';

const hasRetried = new HttpContextToken<boolean>(() => false);

export const refreshInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = inject(ApiUrlService);
  const session = inject(AuthSessionService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const canRefresh =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        apiUrl.isApiUrl(request.url) &&
        !request.url.includes('/auth/') &&
        !request.context.get(hasRetried);

      if (!canRefresh) {
        return throwError(() => error);
      }

      return session.refresh().pipe(
        switchMap(() => next(request.clone({ context: request.context.set(hasRetried, true) }))),
        catchError((refreshError: unknown) => {
          session.clear();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
