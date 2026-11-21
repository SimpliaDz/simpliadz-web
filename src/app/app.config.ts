import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAppRuntimeConfig } from './core/config/app-config.service';
import { provideLocaleBootstrap } from './core/i18n/locale-bootstrap.service';
import { authInterceptor } from './core/api/interceptors/auth.interceptor';
import { refreshInterceptor } from './core/api/interceptors/refresh.interceptor';
import { provideTheme } from './core/theme/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
    provideAnimationsAsync(),
    provideAppRuntimeConfig(),
    provideLocaleBootstrap(),
    provideTheme(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};
