import { DOCUMENT } from '@angular/common';
import { Injectable, LOCALE_ID, inject } from '@angular/core';

export type SupportedLanguage = 'en' | 'fr' | 'ar';

const supportedLanguages: readonly SupportedLanguage[] = ['en', 'fr', 'ar'];

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  const language = value?.trim().toLowerCase();
  return supportedLanguages.includes(language as SupportedLanguage)
    ? (language as SupportedLanguage)
    : 'en';
}

export function localePath(pathname: string, target: SupportedLanguage): string {
  const applicationPath = pathname.replace(/^\/(?:ar|fr)(?=\/|$)/, '') || '/';
  return target === 'en' ? applicationPath : `/${target}${applicationPath}`;
}

/**
 * Angular compiles each supported language into a separate application output. Language changes
 * therefore use a full navigation to the corresponding locale base path instead of attempting to
 * replace translated messages in a running bundle.
 */
@Injectable({ providedIn: 'root' })
export class LanguagePreferenceService {
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);

  current(): SupportedLanguage {
    return normalizeLanguage(this.localeId);
  }

  apply(languageCode: string | null | undefined): void {
    const target = normalizeLanguage(languageCode);
    const location = this.document.defaultView?.location;
    if (!location) {
      return;
    }

    const targetPath = localePath(location.pathname, target);

    // The URL already identifies the requested locale. This also prevents a history fallback
    // from causing repeated redirects before a localized production bundle takes over.
    if (target === this.current() || targetPath === location.pathname) {
      return;
    }

    location.assign(`${targetPath}${location.search}${location.hash}`);
  }
}
