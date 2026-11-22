import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Empty, error and permission-denied states share one layout. */
@Component({
  selector: 'app-state-panel',
  imports: [MatIconModule],
  template: `
    <section class="state-panel" [attr.role]="tone() === 'error' ? 'alert' : null">
      @if (tone() === 'error') {
        <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      } @else {
        <img
          class="state-panel__illustration"
          src="graphics/empty-states/collection-empty.svg"
          alt=""
          aria-hidden="true"
        />
      }
      <h2>{{ title() }}</h2>
      @if (message(); as text) {
        <p>{{ text }}</p>
      }
      <div class="state-panel__actions">
        <ng-content />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatePanelComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  readonly tone = input<'neutral' | 'error'>('neutral');
}
