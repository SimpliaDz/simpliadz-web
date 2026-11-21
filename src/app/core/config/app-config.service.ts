import { HttpClient } from '@angular/common/http';
import { Injectable, inject, provideAppInitializer } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  readonly apiBaseUrl: string;
}

const defaultConfig: AppConfig = { apiBaseUrl: '/api' };

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private config: AppConfig = defaultConfig;

  get value(): AppConfig {
    return this.config;
  }

  async load(): Promise<void> {
    try {
      const loaded = await firstValueFrom(
        this.http.get<Partial<AppConfig>>('config/app-config.json'),
      );

      if (typeof loaded.apiBaseUrl !== 'string') {
        throw new Error('Runtime configuration must define apiBaseUrl as a string.');
      }

      this.config = { apiBaseUrl: loaded.apiBaseUrl.replace(/\/$/, '') };
    } catch (error) {
      console.warn(
        'Runtime configuration could not be loaded; using the default configuration.',
        error,
      );
      this.config = defaultConfig;
    }
  }
}

export function provideAppRuntimeConfig() {
  return provideAppInitializer(() => inject(AppConfigService).load());
}
