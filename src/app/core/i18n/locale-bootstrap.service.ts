import { DOCUMENT } from '@angular/common';
import { Injectable, LOCALE_ID, inject, provideAppInitializer } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocaleBootstrapService {
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);

  initialize(): void {
    const language = this.localeId.split('-')[0];
    this.document.documentElement.lang = language;
    this.document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
}

export function provideLocaleBootstrap() {
  return provideAppInitializer(() => inject(LocaleBootstrapService).initialize());
}
