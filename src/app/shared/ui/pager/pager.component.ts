import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Previous/next paging for lists that the API returns as a plain array without a total.
 * `hasNext` is true when the last page was full.
 */
@Component({
  selector: 'app-pager',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <nav class="pager" aria-label="Pagination" i18n-aria-label="@@pager.label">
      <button
        mat-stroked-button
        type="button"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"
      >
        <mat-icon aria-hidden="true">chevron_left</mat-icon>
        <span i18n="@@pager.previous">Previous</span>
      </button>
      <span class="pager__label" aria-live="polite">
        <span i18n="@@pager.page">Page</span> {{ page() }}
      </span>
      <button
        mat-stroked-button
        type="button"
        [disabled]="!hasNext()"
        (click)="pageChange.emit(page() + 1)"
      >
        <span i18n="@@pager.next">Next</span>
        <mat-icon aria-hidden="true">chevron_right</mat-icon>
      </button>
    </nav>
  `,
  styles: `
    .pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-block-start: 1rem;
    }
    .pager__label {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly hasNext = input<boolean>(false);
  readonly pageChange = output<number>();
}
