import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatusTone = 'success' | 'neutral' | 'warning';

/** Tinted status label (the template's bg-label-* chips, expressed with Material tokens). */
@Component({
  selector: 'app-status-chip',
  template: `<span class="status-chip" [attr.data-tone]="tone()">{{ label() }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChipComponent {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
}
