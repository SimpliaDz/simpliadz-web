import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { describeApiError } from '../../../core/api/api-error-message';
import { toApiError } from '../../../core/api/api-error';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel/state-panel.component';
import { blankToNull } from '../../../shared/forms/form-values';
import { Organization, OrganizationApiService } from '../data-access/organization-api.service';

@Component({
  selector: 'app-organization-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Business identity, contact details, and regional settings."
      i18n-subtitle="@@organization.subtitle"
    />

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message" />
    } @else {
      @if (notConfigured()) {
        <p class="form-hint" role="status" i18n="@@organization.notConfigured">
          Your organization has not been set up yet. Save the profile to create it.
        </p>
      }

      <mat-card appearance="outlined">
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label i18n="@@organization.field.name">Name</mat-label>
                <input matInput formControlName="name" maxlength="200" />
                @if (form.controls.name.hasError('required')) {
                  <mat-error i18n="@@validation.required">This field is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label i18n="@@organization.field.legalName">Legal name</mat-label>
                <input matInput formControlName="legalName" maxlength="250" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label i18n="@@organization.field.email">Email</mat-label>
                <input matInput type="email" formControlName="email" maxlength="254" />
                @if (form.controls.email.hasError('email')) {
                  <mat-error i18n="@@validation.email">Enter a valid email address.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label i18n="@@organization.field.phone">Phone</mat-label>
                <input matInput formControlName="phone" maxlength="50" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-row">
                <mat-label i18n="@@organization.field.address">Address</mat-label>
                <input matInput formControlName="address" maxlength="500" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label i18n="@@organization.field.currency">Currency code</mat-label>
                <input matInput formControlName="currencyCode" maxlength="3" />
                <mat-hint i18n="@@organization.field.currencyHint"
                  >Three letters, for example DZD.</mat-hint
                >
                @if (form.controls.currencyCode.hasError('pattern')) {
                  <mat-error i18n="@@validation.currency">Use three letters.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label i18n="@@organization.field.language">Default language</mat-label>
                <input matInput formControlName="defaultLanguage" maxlength="20" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label i18n="@@organization.field.timeZone">Time zone</mat-label>
                <input
                  matInput
                  formControlName="timeZoneId"
                  maxlength="100"
                  placeholder="Africa/Algiers"
                />
                <mat-hint i18n="@@organization.field.timeZoneHint"
                  >An IANA name. Leave blank to keep the current value.</mat-hint
                >
              </mat-form-field>

              <div class="full-row">
                <mat-slide-toggle formControlName="isActive" i18n="@@organization.field.active">
                  Organization is active
                </mat-slide-toggle>
              </div>
            </div>

            @if (formError(); as message) {
              <p class="form-error" role="alert">{{ message }}</p>
            }

            @if (canManage()) {
              <div class="form-actions">
                <button mat-flat-button type="submit" [disabled]="saving()">
                  <span i18n="@@common.save">Save</span>
                </button>
              </div>
            }
          </form>
        </mat-card-content>
      </mat-card>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationPage {
  private readonly api = inject(OrganizationApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly session = inject(AuthSessionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@organization.heading:Organization`;
  readonly errorTitle = $localize`:@@organization.loadFailed:We could not load the organization`;

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    legalName: ['', [Validators.maxLength(250)]],
    phone: ['', [Validators.maxLength(50)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    address: ['', [Validators.maxLength(500)]],
    currencyCode: ['DZD', [Validators.pattern(/^[A-Za-z]{3}$/)]],
    defaultLanguage: ['', [Validators.maxLength(20)]],
    timeZoneId: ['', [Validators.maxLength(100)]],
    isActive: [true],
  });

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly notConfigured = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly canManage = computed(() => this.session.hasPermission('organization.manage'));

  constructor() {
    if (!this.canManage()) {
      this.form.disable();
    }
    this.load();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);

    this.api
      .save({
        name: value.name.trim(),
        legalName: blankToNull(value.legalName),
        phone: blankToNull(value.phone),
        email: blankToNull(value.email),
        address: blankToNull(value.address),
        currencyCode: blankToNull(value.currencyCode),
        defaultLanguage: blankToNull(value.defaultLanguage),
        isActive: value.isActive,
        timeZoneId: blankToNull(value.timeZoneId),
      })
      .subscribe({
        next: (organization) => {
          this.applyOrganization(organization);
          this.notConfigured.set(false);
          this.saving.set(false);
          this.snackBar.open($localize`:@@organization.saved:Organization saved.`, undefined, {
            duration: 3000,
          });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.formError.set(
            describeApiError(
              error,
              $localize`:@@organization.saveFailed:We could not save the organization.`,
            ),
          );
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.get().subscribe({
      next: (organization) => {
        this.applyOrganization(organization);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (toApiError(error).status === 404) {
          this.notConfigured.set(true);
          return;
        }
        this.loadError.set(
          describeApiError(error, $localize`:@@organization.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  private applyOrganization(organization: Organization): void {
    this.form.reset({
      name: organization.name,
      legalName: organization.legalName ?? '',
      phone: organization.phone ?? '',
      email: organization.email ?? '',
      address: organization.address ?? '',
      currencyCode: organization.currencyCode,
      defaultLanguage: organization.defaultLanguage ?? '',
      timeZoneId: organization.timeZoneId,
      isActive: organization.isActive,
    });
  }
}
