import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describeApiError } from '../../../../core/api/api-error-message';
import { blankToNull } from '../../../../shared/forms/form-values';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { LocationType, LocationsApiService } from '../data-access/locations-api.service';

@Component({
  selector: 'app-location-form-page',
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
    <app-page-header [title]="heading" [backLink]="backLink" />

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
            <mat-label i18n="@@locations.name">Name</mat-label>
            <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
            @if (form.controls.name.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@locations.code">Code</mat-label>
            <input matInput formControlName="code" maxlength="50" />
            <mat-hint i18n="@@locations.codeHint"
              >Optional. Stored in upper case and must be unique.</mat-hint
            >
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@locations.type">Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="Store" i18n="@@locations.type.store">Store</mat-option>
              <mat-option value="Warehouse" i18n="@@locations.type.warehouse">Warehouse</mat-option>
            </mat-select>
            @if (form.controls.type.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@locations.phone">Phone</mat-label>
            <input matInput formControlName="phone" maxlength="50" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-row">
            <mat-label i18n="@@locations.address">Address</mat-label>
            <input matInput formControlName="address" maxlength="500" />
          </mat-form-field>
        </div>

        @if (formError(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }

        <div class="form-actions">
          <a mat-button routerLink="/app/inventory/locations" i18n="@@common.cancel">Cancel</a>
          <button mat-flat-button type="submit" [disabled]="saving()">
            <span i18n="@@common.save">Save</span>
          </button>
        </div>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationFormPage {
  private readonly api = inject(LocationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly locationId = this.route.snapshot.paramMap.get('id');

  readonly heading = this.locationId
    ? $localize`:@@locations.form.editHeading:Edit location`
    : $localize`:@@locations.form.createHeading:New location`;
  readonly backLink = {
    label: $localize`:@@locations.backToList:All locations`,
    path: '/app/inventory/locations',
  };
  readonly errorTitle = $localize`:@@locations.form.loadFailed:We could not load this location`;

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    code: ['', [Validators.maxLength(50)]],
    type: this.formBuilder.control<LocationType | ''>('', [Validators.required]),
    address: ['', [Validators.maxLength(500)]],
    phone: ['', [Validators.maxLength(50)]],
  });

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.locationId) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.api.get(this.locationId).subscribe({
      next: (location) => {
        this.form.reset({
          name: location.name,
          code: location.code ?? '',
          type: location.type,
          address: location.address ?? '',
          phone: location.phone ?? '',
        });
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@locations.form.loadFailedHint:Try again in a moment.`,
          ),
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
    if (value.type === '') {
      return;
    }
    const request = {
      name: value.name.trim(),
      code: blankToNull(value.code),
      type: value.type,
      address: blankToNull(value.address),
      phone: blankToNull(value.phone),
    };

    this.saving.set(true);
    this.formError.set(null);
    const call = this.locationId
      ? this.api.update(this.locationId, request)
      : this.api.create(request);
    call.subscribe({
      next: () => {
        this.snackBar.open($localize`:@@locations.saved:Location saved.`, undefined, {
          duration: 3000,
        });
        void this.router.navigate(['/app/inventory/locations']);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(
          describeApiError(
            error,
            $localize`:@@locations.saveFailed:We could not save the location.`,
          ),
        );
      },
    });
  }
}
