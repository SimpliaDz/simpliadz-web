import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { toApiError } from '../../../core/api/api-error';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import {
  LanguagePreferenceService,
  SupportedLanguage,
  normalizeLanguage,
} from '../../../core/i18n/language-preference.service';
import { AuthApiService } from '../../auth/data-access/auth-api.service';

@Component({
  selector: 'app-profile-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 i18n="@@account.profile.heading">Profile</h1>
        <p class="page-subtitle" i18n="@@account.profile.subtitle">
          Manage your personal application preferences.
        </p>
      </div>
    </header>

    <mat-card appearance="outlined" class="profile-card">
      <mat-card-header>
        <mat-icon mat-card-avatar aria-hidden="true">language</mat-icon>
        <mat-card-title i18n="@@account.profile.language.title">Display language</mat-card-title>
        <mat-card-subtitle i18n="@@account.profile.language.help"
          >Choose the language used throughout SimpliaWear.</mat-card-subtitle
        >
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="saveLanguage()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@account.profile.language.label">Language</mat-label>
            <mat-select formControlName="languageCode">
              <mat-option value="en" i18n="@@language.english">English</mat-option>
              <mat-option value="fr" i18n="@@language.french">French</mat-option>
              <mat-option value="ar" i18n="@@language.arabic">Arabic</mat-option>
            </mat-select>
          </mat-form-field>

          <p class="form-hint" i18n="@@account.profile.language.redirect">
            Saving reloads the application in your selected language.
          </p>

          @if (error(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }

          <div class="actions">
            <button mat-flat-button type="submit" [disabled]="saving() || !hasChanged()">
              <span i18n="@@account.profile.language.save">Save language</span>
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .profile-card {
      max-width: 36rem;
    }
    mat-card-header {
      padding-block-end: 0.75rem;
    }
    form {
      display: grid;
      gap: 0.75rem;
      padding-block-start: 0.5rem;
    }
    mat-form-field {
      width: 100%;
    }
    .form-hint,
    .form-error {
      margin: 0;
    }
    .form-error {
      color: var(--mat-sys-error);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-block-start: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly api = inject(AuthApiService);
  private readonly session = inject(AuthSessionService);
  private readonly languagePreference = inject(LanguagePreferenceService);

  readonly selectedLanguage = normalizeLanguage(this.session.user()?.languageCode);
  readonly form = this.formBuilder.group({ languageCode: this.selectedLanguage });
  // Reactive form values are not Angular signals. Bridge the control's value changes so the
  // computed state is re-evaluated immediately when an option is selected.
  readonly currentLanguage = toSignal(
    this.form.controls.languageCode.valueChanges.pipe(startWith(this.selectedLanguage)),
    { initialValue: this.selectedLanguage },
  );
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasChanged = computed(() => this.currentLanguage() !== this.selectedLanguage);

  saveLanguage(): void {
    const languageCode = this.form.controls.languageCode.value as SupportedLanguage;
    this.saving.set(true);
    this.error.set(null);

    this.api.updateLanguage(languageCode).subscribe({
      next: (response) => {
        this.session.setLanguage(response.languageCode);
        this.languagePreference.apply(response.languageCode);
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          toApiError(error).message ??
            $localize`:@@account.profile.language.failed:We could not save your language preference. Try again.`,
        );
      },
    });
  }
}
