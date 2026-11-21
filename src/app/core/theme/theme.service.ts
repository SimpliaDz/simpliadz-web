import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, provideAppInitializer, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const storageKey = 'simpliadz.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = this.document.defaultView?.localStorage;

  readonly theme = signal<Theme>('light');
  readonly isDark = computed(() => this.theme() === 'dark');

  initialize(): void {
    const storedTheme = this.storage?.getItem(storageKey);
    this.setTheme(storedTheme === 'dark' ? 'dark' : 'light');
  }

  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.document.documentElement.dataset['theme'] = theme;
    this.storage?.setItem(storageKey, theme);
  }
}

export function provideTheme() {
  return provideAppInitializer(() => inject(ThemeService).initialize());
}
