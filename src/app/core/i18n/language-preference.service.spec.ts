import { describe, expect, it } from 'vitest';
import { localePath, normalizeLanguage } from './language-preference.service';

describe('language preference paths', () => {
  it('normalizes backend language values to supported application locales', () => {
    expect(normalizeLanguage(' FR ')).toBe('fr');
    expect(normalizeLanguage('ar')).toBe('ar');
    expect(normalizeLanguage('de')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
  });

  it('preserves the application route while changing locale base paths', () => {
    expect(localePath('/app/account/profile', 'fr')).toBe('/fr/app/account/profile');
    expect(localePath('/ar/app/account/profile', 'en')).toBe('/app/account/profile');
    expect(localePath('/fr/app/catalogue/products', 'ar')).toBe('/ar/app/catalogue/products');
    expect(localePath('/fr/app/account/profile', 'fr')).toBe('/fr/app/account/profile');
  });
});
