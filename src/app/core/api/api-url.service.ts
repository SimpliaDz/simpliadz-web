import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';

@Injectable({ providedIn: 'root' })
export class ApiUrlService {
  private readonly config = inject(AppConfigService);

  path(path: string): string {
    return `${this.config.value.apiBaseUrl}/${path.replace(/^\//, '')}`;
  }

  isApiUrl(url: string): boolean {
    const { apiBaseUrl } = this.config.value;
    return apiBaseUrl.length > 0 && (url === apiBaseUrl || url.startsWith(`${apiBaseUrl}/`));
  }
}
