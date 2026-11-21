import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthApiService } from '../../data-access/auth-api.service';

@Component({
  selector: 'app-forgot-password-page',
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
          <mat-card-title><h1>Reset your password</h1></mat-card-title>
          <mat-card-subtitle>Enter your email address to begin.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (resetToken()) {
            <p class="auth-success">A development reset token was generated.</p>
            <button mat-flat-button type="button" (click)="continueToReset()">
              Continue to reset password
            </button>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field appearance="outline">
                <mat-label>Email address</mat-label>
                <input matInput type="email" autocomplete="email" formControlName="email" />
                @if (form.controls.email.invalid && form.controls.email.touched) {
                  <mat-error>Enter a valid email address.</mat-error>
                }
              </mat-form-field>
              @if (error()) {
                <p class="auth-error" role="alert">{{ error() }}</p>
              }
              <button mat-flat-button type="submit" [disabled]="submitting()">
                Send reset request
              </button>
            </form>
          }
        </mat-card-content>
        <mat-card-actions><a mat-button routerLink="/login">Back to sign in</a></mat-card-actions>
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
export class ForgotPasswordPage {
  private readonly api = inject(AuthApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  readonly form = this.formBuilder.group({ email: ['', [Validators.required, Validators.email]] });
  readonly error = signal<string | null>(null);
  readonly resetToken = signal<string | null>(null);
  readonly submitting = signal(false);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.forgotPassword(this.form.controls.email.value).subscribe({
      next: (response) => {
        this.resetToken.set(response.resetToken);
        this.submitting.set(false);
      },
      error: () => {
        this.error.set('We could not process the reset request. Try again later.');
        this.submitting.set(false);
      },
    });
  }

  continueToReset(): void {
    void this.router.navigate(['/reset-password'], {
      queryParams: { email: this.form.controls.email.value, token: this.resetToken() },
    });
  }
}
