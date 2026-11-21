import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from './auth-session.service';

/** Route data key holding the permission strings a route requires (all of them). */
export const requiredPermissionsKey = 'permissions';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);

  return session
    .restore()
    .pipe(
      map((signedIn) =>
        signedIn
          ? true
          : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
      ),
    );
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(AuthSessionService);
  const router = inject(Router);

  return session
    .restore()
    .pipe(map((signedIn) => (signedIn ? router.createUrlTree(['/app']) : true)));
};

/**
 * UX only: the API enforces every permission. This guard simply avoids showing screens
 * the user cannot use. Must run after authGuard, which guarantees the user is loaded.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  const required = (route.data[requiredPermissionsKey] as readonly string[] | undefined) ?? [];

  return session.hasAllPermissions(required) ? true : router.createUrlTree(['/app/forbidden']);
};
