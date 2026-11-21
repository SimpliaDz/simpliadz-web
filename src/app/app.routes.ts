import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/public-layout.component').then((m) => m.PublicLayoutComponent),
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        title: $localize`:@@title.signIn:Sign in | SimpliaDz`,
        loadComponent: () =>
          import('./features/auth/pages/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'forgot-password',
        canActivate: [guestGuard],
        title: $localize`:@@title.forgotPassword:Reset password | SimpliaDz`,
        loadComponent: () =>
          import('./features/auth/pages/forgot-password/forgot-password.page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-password',
        canActivate: [guestGuard],
        title: $localize`:@@title.resetPassword:Choose a password | SimpliaDz`,
        loadComponent: () =>
          import('./features/auth/pages/reset-password/reset-password.page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
    ],
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/shell-layout.component').then((m) => m.ShellLayoutComponent),
    title: 'SimpliaDz',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: $localize`:@@title.dashboard:Dashboard | SimpliaDz`,
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'account/security',
        title: $localize`:@@title.accountSecurity:Security | SimpliaDz`,
        loadComponent: () =>
          import('./features/account/pages/security.page').then((m) => m.SecurityPage),
      },
      {
        path: 'forbidden',
        title: $localize`:@@title.forbidden:Access denied | SimpliaDz`,
        loadComponent: () =>
          import('./features/errors/pages/forbidden.page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: $localize`:@@title.notFound:Page not found | SimpliaDz`,
        loadComponent: () =>
          import('./features/errors/pages/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
  { path: '**', redirectTo: 'app' },
];
