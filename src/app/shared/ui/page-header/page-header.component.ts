import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

export interface BackLink {
  readonly label: string;
  readonly path: string;
}

/** Page title block used by every feature screen. Projected content renders as actions. */
@Component({
  selector: 'app-page-header',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        @if (backLink(); as back) {
          <a mat-button class="back-link" [routerLink]="back.path">
            <mat-icon aria-hidden="true">arrow_back</mat-icon>
            <span>{{ back.label }}</span>
          </a>
        }
        <h1>{{ title() }}</h1>
        @if (subtitle(); as text) {
          <p class="page-subtitle">{{ text }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly backLink = input<BackLink | null>(null);
}
