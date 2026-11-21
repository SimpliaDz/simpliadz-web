import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import {
  PermissionDefinition,
  RoleDetail,
  RolesApiService,
} from '../data-access/roles-api.service';

interface PermissionGroup {
  readonly category: string;
  readonly permissions: PermissionDefinition[];
}

@Component({
  selector: 'app-role-detail-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatProgressBarModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    StatePanelComponent,
  ],
  template: `
    <app-page-header [title]="role()?.name ?? heading" [backLink]="backLink" [subtitle]="subtitle">
      @if (canManage() && dirty()) {
        <button mat-flat-button type="button" [disabled]="saving()" (click)="save()">
          <span i18n="@@common.save">Save</span>
        </button>
      }
    </app-page-header>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else {
      @if (!canManage()) {
        <p class="form-hint" role="status" i18n="@@roles.readOnly">
          You can view this role but not change it.
        </p>
      }
      @if (formError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      <div class="card-grid">
        @for (group of groups(); track group.category) {
          <mat-card appearance="outlined">
            <mat-card-header>
              <mat-card-title>{{ group.category }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (permission of group.permissions; track permission.name) {
                <mat-checkbox
                  [formControl]="controlFor(permission.name)"
                  [disabled]="!canManage() || saving()"
                  class="permission-option"
                >
                  <span class="permission-name">{{ permission.displayName }}</span>
                  <span class="permission-key muted">{{ permission.name }}</span>
                </mat-checkbox>
              }
            </mat-card-content>
          </mat-card>
        } @empty {
          <app-state-panel icon="lock_open" [title]="emptyTitle" />
        }
      </div>
    }
  `,
  styles: `
    .permission-option {
      display: block;
      margin-block: 0.25rem;
    }
    .permission-name {
      display: block;
    }
    .permission-key {
      display: block;
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleDetailPage {
  private readonly api = inject(RolesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(AuthSessionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly roleId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly heading = $localize`:@@roles.detail.heading:Role`;
  readonly subtitle = $localize`:@@roles.detail.subtitle:Tick the permissions this role grants, then save.`;
  readonly backLink = {
    label: $localize`:@@roles.backToList:All roles`,
    path: '/app/administration/roles',
  };
  readonly errorTitle = $localize`:@@roles.detail.loadFailed:We could not load this role`;
  readonly emptyTitle = $localize`:@@roles.detail.noPermissions:No permissions are defined yet`;

  readonly canManage = computed(() => this.session.hasPermission('roles.manage'));
  readonly role = signal<RoleDetail | null>(null);
  readonly groups = signal<PermissionGroup[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly dirty = signal(false);

  private readonly controls = new Map<string, FormControl<boolean>>();
  private baseline = new Set<string>();

  constructor() {
    this.load();
  }

  controlFor(name: string): FormControl<boolean> {
    let control = this.controls.get(name);
    if (!control) {
      control = this.formBuilder.control(false);
      control.valueChanges.subscribe(() => this.dirty.set(this.hasChanges()));
      this.controls.set(name, control);
    }
    return control;
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      role: this.api.get(this.roleId),
      catalogue: this.api.permissionCatalogue(),
    }).subscribe({
      next: ({ role, catalogue }) => {
        this.role.set(role);
        this.groups.set(this.group(catalogue));
        this.baseline = new Set(role.permissions);
        for (const permission of catalogue) {
          this.controlFor(permission.name).setValue(this.baseline.has(permission.name), {
            emitEvent: false,
          });
        }
        this.dirty.set(false);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@roles.detail.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  save(): void {
    const selected = this.selectedNames();
    const added = [...selected].filter((name) => !this.baseline.has(name));
    const removed = [...this.baseline].filter((name) => !selected.has(name));

    this.saving.set(true);
    this.formError.set(null);

    const steps = [
      added.length ? this.api.addPermissions(this.roleId, added) : null,
      removed.length ? this.api.removePermissions(this.roleId, removed) : null,
    ].filter((step): step is NonNullable<typeof step> => step !== null);

    if (steps.length === 0) {
      this.saving.set(false);
      this.load();
      return;
    }

    forkJoin(steps).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open($localize`:@@roles.saved:Permissions saved.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(
          describeApiError(
            error,
            $localize`:@@roles.permissionsFailed:We could not save the permissions.`,
          ),
        );
      },
    });
  }

  private selectedNames(): Set<string> {
    return new Set(
      [...this.controls.entries()].filter(([, control]) => control.value).map(([name]) => name),
    );
  }

  private hasChanges(): boolean {
    const selected = this.selectedNames();
    return (
      selected.size !== this.baseline.size || [...selected].some((name) => !this.baseline.has(name))
    );
  }

  private group(catalogue: PermissionDefinition[]): PermissionGroup[] {
    const byCategory = new Map<string, PermissionDefinition[]>();
    for (const permission of catalogue) {
      const list = byCategory.get(permission.category) ?? [];
      list.push(permission);
      byCategory.set(permission.category, list);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, permissions]) => ({
        category,
        permissions: [...permissions].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }
}
