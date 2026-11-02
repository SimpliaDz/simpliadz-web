import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.service';

@Injectable({ providedIn: 'root' })
export class ApiUrlService {
  private readonly config = inject(APP_CONFIG);

  path(path: string): string {
    return `${this.config.apiBaseUrl}/${path.replace(/^\//, '')}`;
  }

  isApiUrl(url: string): boolean {
    return url === this.config.apiBaseUrl || url.startsWith(`${this.config.apiBaseUrl}/`);
  }
}
