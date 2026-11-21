import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { toApiError } from '../../../core/api/api-error';
import { AuthApiService } from '../../auth/data-access/auth-api.service';

const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword
    ? { passwordMismatch: true }
    : null;
};

@Component({
  selector: 'app-security-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <header class="page-header">
      <h1 i18n="@@account.security.heading">Security</h1>
      <p class="page-subtitle" i18n="@@account.security.subtitle">
        Change your password. You will be signed out on every device and must sign in again.
      </p>
    </header>

    <mat-card appearance="outlined" class="form-card">
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@account.security.currentPassword">Current password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="current-password"
              formControlName="currentPassword"
            />
            @if (form.controls.currentPassword.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@account.security.newPassword">New password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="new-password"
              formControlName="newPassword"
            />
            @if (form.controls.newPassword.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            } @else if (form.controls.newPassword.hasError('minlength')) {
              <mat-error i18n="@@validation.passwordMinLength"
                >Use at least 8 characters.</mat-error
              >
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@account.security.confirmPassword">Confirm new password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="new-password"
              formControlName="confirmPassword"
            />
            @if (form.controls.confirmPassword.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>

          @if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) {
            <p class="form-error" role="alert" i18n="@@validation.passwordMismatch">
              The passwords do not match.
            </p>
          }

          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }

          <div class="actions">
            <button mat-flat-button type="submit" [disabled]="submitting()">
              <span i18n="@@account.security.submit">Change password</span>
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .page-header {
      margin-block-end: 1.5rem;
    }
    .page-header h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
    }
    .page-subtitle {
      margin: 0.25rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .form-card {
      max-width: 32rem;
    }
    form {
      display: grid;
      gap: 0.5rem;
      padding-block-start: 0.5rem;
    }
    mat-form-field {
      width: 100%;
    }
    .form-error {
      margin: 0;
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
export class SecurityPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly api = inject(AuthApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);

  readonly form = this.formBuilder.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);

    this.api.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        // The backend revokes every session on password change; sign in again.
        this.session.clear();
        void this.router.navigate(['/login'], { queryParams: { reason: 'password-changed' } });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const details = toApiError(error);
        this.error.set(
          details.message ??
            $localize`:@@account.security.failed:We could not change your password. Check your current password and try again.`,
        );
      },
    });
  }
}
