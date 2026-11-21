import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { RoleSummary, RolesApiService } from '../data-access/roles-api.service';

@Component({
  selector: 'app-roles-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Roles bundle permissions. A user gets every permission of every role they hold."
      i18n-subtitle="@@roles.subtitle"
    />

    @if (canManage()) {
      <form class="toolbar" [formGroup]="form" (ngSubmit)="create()" novalidate>
        <mat-form-field appearance="outline" class="search-field">
          <mat-label i18n="@@roles.field.name">Role name</mat-label>
          <input matInput formControlName="name" maxlength="100" />
          @if (form.controls.name.hasError('required')) {
            <mat-error i18n="@@validation.required">This field is required.</mat-error>
          }
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="saving()">
          <mat-icon aria-hidden="true">add</mat-icon>
          <span i18n="@@roles.create">Create role</span>
        </button>
      </form>
      @if (formError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
    }

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (roles().length === 0) {
      <app-state-panel icon="shield_person" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="roles()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let role">{{ role.name }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let role" class="actions-cell">
              <a mat-stroked-button [routerLink]="['/app/administration/roles', role.id]">
                <span i18n="@@roles.permissions">Permissions</span>
              </a>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly api = inject(RolesApiService);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly heading = $localize`:@@roles.heading:Roles`;
  readonly errorTitle = $localize`:@@roles.loadFailed:We could not load roles`;
  readonly emptyTitle = $localize`:@@roles.empty.title:No roles yet`;
  readonly emptyMessage = $localize`:@@roles.empty.message:Create a role, then choose the permissions it grants.`;
  readonly columns = ['name', 'actions'];

  readonly canManage = computed(() => this.session.hasPermission('roles.manage'));
  readonly roles = signal<RoleSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (roles) => {
        this.roles.set([...roles].sort((a, b) => a.name.localeCompare(b.name)));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@roles.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.api.create(this.form.getRawValue().name.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset({ name: '' });
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(
          describeApiError(error, $localize`:@@roles.saveFailed:We could not create the role.`),
        );
      },
    });
  }
}
