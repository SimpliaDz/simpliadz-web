import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { RoleSummary, RolesApiService } from '../../roles/data-access/roles-api.service';
import { UserSummary, UsersApiService } from '../data-access/users-api.service';

@Component({
  selector: 'app-user-detail-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (user(); as current) {
      <app-page-header
        [title]="current.email"
        [backLink]="backLink"
        [subtitle]="current.firstName + ' ' + current.lastName"
      >
        <app-status-chip
          [label]="current.isActive ? activeLabel : inactiveLabel"
          [tone]="current.isActive ? 'success' : 'neutral'"
        />
        @if (canEdit()) {
          @if (current.isActive) {
            <button
              mat-stroked-button
              type="button"
              [disabled]="busy()"
              (click)="toggleActive(current)"
            >
              <mat-icon aria-hidden="true">block</mat-icon>
              <span i18n="@@common.deactivate">Deactivate</span>
            </button>
          } @else {
            <button
              mat-stroked-button
              type="button"
              [disabled]="busy()"
              (click)="toggleActive(current)"
            >
              <mat-icon aria-hidden="true">check_circle</mat-icon>
              <span i18n="@@common.activate">Activate</span>
            </button>
          }
        }
      </app-page-header>

      @if (actionError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      <div class="card-grid">
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title i18n="@@users.roles">Roles</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (canEdit()) {
              <form [formGroup]="rolesForm" (ngSubmit)="saveRoles(current)" novalidate>
                <mat-form-field appearance="outline" class="full-row">
                  <mat-label i18n="@@users.roles">Roles</mat-label>
                  <mat-select formControlName="roles" multiple>
                    @for (role of roles(); track role.id) {
                      <mat-option [value]="role.name">{{ role.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <div class="form-actions">
                  <button mat-flat-button type="submit" [disabled]="busy()">
                    <span i18n="@@common.save">Save</span>
                  </button>
                </div>
              </form>
            } @else {
              <ul class="chip-list">
                @for (role of current.roles; track role) {
                  <li>{{ role }}</li>
                } @empty {
                  <li class="muted" i18n="@@users.noRoles">No roles</li>
                }
              </ul>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title i18n="@@users.effectivePermissions"
              >Effective permissions</mat-card-title
            >
          </mat-card-header>
          <mat-card-content>
            @if (permissions().length) {
              <ul class="chip-list">
                @for (permission of permissions(); track permission) {
                  <li>{{ permission }}</li>
                }
              </ul>
            } @else {
              <p class="muted" i18n="@@users.noPermissions">This user has no permissions.</p>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <dl class="detail-list section-title">
        <dt i18n="@@users.email">Email</dt>
        <dd>{{ current.email }}</dd>
        <dt i18n="@@users.emailConfirmed">Email confirmed</dt>
        <dd>{{ current.emailConfirmed ? yesLabel : noLabel }}</dd>
      </dl>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetailPage {
  private readonly api = inject(UsersApiService);
  private readonly roleApi = inject(RolesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(AuthSessionService);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly userId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly errorTitle = $localize`:@@users.detail.loadFailed:We could not load this user`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly yesLabel = $localize`:@@common.yes:Yes`;
  readonly noLabel = $localize`:@@common.no:No`;
  readonly backLink = {
    label: $localize`:@@users.backToList:All users`,
    path: '/app/administration/users',
  };

  readonly canEdit = computed(() => this.session.hasPermission('users.edit'));
  readonly user = signal<UserSummary | null>(null);
  readonly roles = signal<RoleSummary[]>([]);
  readonly permissions = signal<string[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly rolesForm = this.formBuilder.group({
    roles: this.formBuilder.control<string[]>([]),
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      user: this.api.get(this.userId),
      roles: this.roleApi.list(),
      permissions: this.api.effectivePermissions(this.userId),
    }).subscribe({
      next: ({ user, roles, permissions }) => {
        this.user.set(user);
        this.roles.set(roles);
        this.permissions.set([...permissions.permissions].sort());
        this.rolesForm.reset({ roles: [...user.roles] });
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@users.detail.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  saveRoles(current: UserSummary): void {
    const selected = new Set(this.rolesForm.getRawValue().roles);
    const existing = new Set(current.roles);
    const added = [...selected].filter((role) => !existing.has(role));
    const removed = [...existing].filter((role) => !selected.has(role));

    if (added.length === 0 && removed.length === 0) {
      this.snackBar.open($localize`:@@users.rolesUnchanged:No role changes to save.`, undefined, {
        duration: 3000,
      });
      return;
    }

    this.busy.set(true);
    this.actionError.set(null);
    const steps = [
      added.length ? this.api.assignRoles(current.id, added) : null,
      removed.length ? this.api.removeRoles(current.id, removed) : null,
    ].filter((step): step is NonNullable<typeof step> => step !== null);

    forkJoin(steps).subscribe({
      next: () => {
        this.busy.set(false);
        this.snackBar.open($localize`:@@users.rolesSaved:Roles saved.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(error, $localize`:@@users.rolesFailed:We could not save the roles.`),
        );
      },
    });
  }

  toggleActive(current: UserSummary): void {
    if (current.isActive) {
      this.confirm
        .confirm({
          title: $localize`:@@users.deactivate.title:Deactivate user?`,
          message: $localize`:@@users.deactivate.message:The user is signed out everywhere and cannot sign in until reactivated. This change is recorded in the audit trail.`,
          confirmLabel: $localize`:@@common.deactivate:Deactivate`,
          destructive: true,
        })
        .subscribe((confirmed) => {
          if (confirmed) {
            this.setActive(current.id, false);
          }
        });
    } else {
      this.setActive(current.id, true);
    }
  }

  private setActive(id: string, active: boolean): void {
    this.busy.set(true);
    this.actionError.set(null);
    const call = active ? this.api.activate(id) : this.api.deactivate(id);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.snackBar.open(
          active
            ? $localize`:@@users.activated:User activated.`
            : $localize`:@@users.deactivated:User deactivated.`,
          undefined,
          { duration: 3000 },
        );
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(
            error,
            $localize`:@@users.statusFailed:The user status could not be changed.`,
          ),
        );
      },
    });
  }
}
