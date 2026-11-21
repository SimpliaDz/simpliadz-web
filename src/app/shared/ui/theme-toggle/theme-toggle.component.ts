import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button mat-icon-button type="button" (click)="theme.toggle()" [attr.aria-label]="label()">
      <mat-icon aria-hidden="true">{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  readonly label = computed(() =>
    this.theme.isDark()
      ? $localize`:@@theme.switchToLight:Switch to light theme`
      : $localize`:@@theme.switchToDark:Switch to dark theme`,
  );
}
