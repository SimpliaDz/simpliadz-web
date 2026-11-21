import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describeApiError } from '../../../../core/api/api-error-message';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { RoleSummary, RolesApiService } from '../../roles/data-access/roles-api.service';
import { UsersApiService } from '../data-access/users-api.service';

@Component({
  selector: 'app-user-create-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      [backLink]="backLink"
      subtitle="The user signs in with this email and password. Share the password securely."
      i18n-subtitle="@@users.create.subtitle"
    />

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="form-surface">
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@users.firstName">First name</mat-label>
            <input matInput formControlName="firstName" maxlength="100" cdkFocusInitial />
            @if (form.controls.firstName.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@users.lastName">Last name</mat-label>
            <input matInput formControlName="lastName" maxlength="100" />
            @if (form.controls.lastName.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@users.email">Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="off" />
            @if (form.controls.email.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            } @else if (form.controls.email.hasError('email')) {
              <mat-error i18n="@@validation.email">Enter a valid email address.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@users.password">Temporary password</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            <mat-hint i18n="@@users.passwordHint"
              >At least 8 characters with upper and lower case letters, a digit and a
              symbol.</mat-hint
            >
            @if (form.controls.password.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            } @else if (form.controls.password.hasError('minlength')) {
              <mat-error i18n="@@validation.passwordMinLength"
                >Use at least 8 characters.</mat-error
              >
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@users.roles">Roles</mat-label>
            <mat-select formControlName="roles" multiple>
              @for (role of roles(); track role.id) {
                <mat-option [value]="role.name">{{ role.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (formError(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }

        <div class="form-actions">
          <a mat-button routerLink="/app/administration/users" i18n="@@common.cancel">Cancel</a>
          <button mat-flat-button type="submit" [disabled]="saving()">
            <span i18n="@@common.create">Create</span>
          </button>
        </div>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCreatePage {
  private readonly users = inject(UsersApiService);
  private readonly roleApi = inject(RolesApiService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly heading = $localize`:@@users.create.heading:New user`;
  readonly backLink = {
    label: $localize`:@@users.backToList:All users`,
    path: '/app/administration/users',
  };
  readonly errorTitle = $localize`:@@users.create.loadFailed:We could not load the roles`;

  readonly form = this.formBuilder.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    roles: this.formBuilder.control<string[]>([]),
  });

  readonly roles = signal<RoleSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.roleApi.list().subscribe({
      next: (roles) => {
        this.roles.set([...roles].sort((a, b) => a.name.localeCompare(b.name)));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@users.create.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);

    this.users
      .create({
        email: value.email.trim(),
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        password: value.password,
        roles: value.roles,
      })
      .subscribe({
        next: ({ id }) => {
          this.snackBar.open($localize`:@@users.created:User created.`, undefined, {
            duration: 3000,
          });
          void this.router.navigate(['/app/administration/users', id]);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.formError.set(
            describeApiError(error, $localize`:@@users.saveFailed:We could not create the user.`),
          );
        },
      });
  }
}
