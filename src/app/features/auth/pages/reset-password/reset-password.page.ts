import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthApiService } from '../../data-access/auth-api.service';

@Component({
  selector: 'app-reset-password-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <main class="auth-page">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title><h1>Choose a new password</h1></mat-card-title>
          <mat-card-subtitle
            >Use the reset token from your password reset request.</mat-card-subtitle
          >
        </mat-card-header>
        <mat-card-content>
          @if (completed()) {
            <p class="auth-success">Your password has been reset. You can now sign in.</p>
            <a mat-flat-button routerLink="/login">Go to sign in</a>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field appearance="outline">
                <mat-label>Email address</mat-label>
                <input matInput type="email" autocomplete="email" formControlName="email" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Reset token</mat-label>
                <input matInput autocomplete="one-time-code" formControlName="resetToken" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>New password</mat-label>
                <input
                  matInput
                  type="password"
                  autocomplete="new-password"
                  formControlName="newPassword"
                />
                @if (form.controls.newPassword.hasError('minlength')) {
                  <mat-error>Use at least 8 characters.</mat-error>
                }
              </mat-form-field>
              @if (error()) {
                <p class="auth-error" role="alert">{{ error() }}</p>
              }
              <button mat-flat-button type="submit" [disabled]="submitting()">
                Reset password
              </button>
            </form>
          }
        </mat-card-content>
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
    }
    form {
      display: grid;
      gap: 0.5rem;
      padding-top: 1rem;
    }
    mat-form-field {
      width: 100%;
    }
    .auth-error {
      color: var(--mat-sys-error);
    }
    .auth-success {
      color: var(--mat-sys-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly api = inject(AuthApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.formBuilder.group({
    email: [
      this.route.snapshot.queryParamMap.get('email') ?? '',
      [Validators.required, Validators.email],
    ],
    resetToken: [this.route.snapshot.queryParamMap.get('token') ?? '', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });
  readonly completed = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.api.resetPassword(value.email, value.resetToken, value.newPassword).subscribe({
      next: () => {
        this.completed.set(true);
        this.submitting.set(false);
      },
      error: () => {
        this.error.set('We could not reset your password. Check the token and try again.');
        this.submitting.set(false);
      },
    });
  }
}
