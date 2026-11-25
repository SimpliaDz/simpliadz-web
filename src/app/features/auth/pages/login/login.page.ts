import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';

@Component({
  selector: 'app-login-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <main class="auth-page">
      <mat-card class="auth-card">
        <div class="auth-visual" aria-hidden="true">
          <img src="graphics/illustrations/operations-overview.svg" alt="" />
        </div>
        <mat-card-header>
          <mat-card-title><h1 i18n="@@auth.login.heading">Sign in to Simplia</h1></mat-card-title>
          <mat-card-subtitle i18n="@@auth.login.subtitle"
            >Use your organization account to continue.</mat-card-subtitle
          >
        </mat-card-header>

        <mat-card-content>
          @if (passwordChanged) {
            <p class="auth-notice" role="status" i18n="@@auth.login.passwordChanged">
              Your password was changed. Sign in again to continue.
            </p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@auth.field.email">Email address</mat-label>
              <input
                matInput
                class="auth-credential-input"
                dir="ltr"
                lang="en"
                type="email"
                autocomplete="email"
                formControlName="email"
              />
              @if (form.controls.email.hasError('required')) {
                <mat-error i18n="@@auth.error.emailRequired">Email is required.</mat-error>
              } @else if (form.controls.email.hasError('email')) {
                <mat-error i18n="@@validation.email">Enter a valid email address.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@auth.field.password">Password</mat-label>
              <input
                matInput
                class="auth-credential-input"
                dir="ltr"
                lang="en"
                type="password"
                autocomplete="current-password"
                formControlName="password"
              />
              @if (form.controls.password.hasError('required')) {
                <mat-error i18n="@@auth.error.passwordRequired">Password is required.</mat-error>
              }
            </mat-form-field>

            @if (error()) {
              <p class="auth-error" role="alert">{{ error() }}</p>
            }

            <button mat-flat-button type="submit" [disabled]="submitting()">
              @if (submitting()) {
                <mat-spinner
                  diameter="20"
                  i18n-aria-label="@@auth.login.signingIn"
                  aria-label="Signing in"
                ></mat-spinner>
              } @else {
                <span i18n="@@auth.login.submit">Sign in</span>
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions>
          <a mat-button routerLink="/forgot-password" i18n="@@auth.login.forgot"
            >Forgot your password?</a
          >
        </mat-card-actions>
      </mat-card>
    </main>
  `,
  styles: `
    .auth-page {
      display: grid;
      min-height: calc(100vh - 8rem);
      place-items: center;
    }
    .auth-card {
      width: min(100%, 28rem);
      overflow: hidden;
      border-block-start: 0.25rem solid var(--mat-sys-primary);
      box-shadow: 0 1rem 2.5rem color-mix(in srgb, var(--mat-sys-primary) 7%, transparent);
    }
    .auth-visual {
      height: 7.25rem;
      overflow: hidden;
      background: var(--app-soft-primary);
    }
    .auth-visual img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 57%;
    }
    mat-card-header {
      padding-block: 1.5rem 0.5rem;
    }
    h1 {
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    form {
      display: grid;
      gap: 0.5rem;
      padding-top: 1rem;
    }
    mat-form-field {
      width: 100%;
    }
    button {
      min-height: 2.75rem;
      margin-block-start: 0.25rem;
    }
    .auth-error {
      color: var(--mat-sys-error);
      margin: 0;
    }
    .auth-notice {
      margin: 0;
      color: var(--mat-sys-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);

  readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordChanged = this.route.snapshot.queryParamMap.get('reason') === 'password-changed';

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.session.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl?.startsWith('/app') ? returnUrl : '/app');
      },
      error: () => {
        this.error.set(
          $localize`:@@auth.login.failed:We could not sign you in. Check your email and password, then try again.`,
        );
        this.submitting.set(false);
      },
    });
  }
}
