import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { provideAppRuntimeConfig } from './core/config/app-config.service';
import { provideLocaleBootstrap } from './core/i18n/locale-bootstrap.service';
import { authInterceptor } from './core/api/interceptors/auth.interceptor';
import { refreshInterceptor } from './core/api/interceptors/refresh.interceptor';
import { provideTheme } from './core/theme/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Order matters: authInterceptor attaches the bearer token first, then refreshInterceptor
    // handles a 401 by refreshing and replaying the request.
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
    provideAnimationsAsync(),
    // mat-icon ligatures use the Material Symbols font loaded in index.html.
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
    provideAppRuntimeConfig(),
    provideLocaleBootstrap(),
    provideTheme(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};
