import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { UserSummary, UsersApiService } from '../data-access/users-api.service';

@Component({
  selector: 'app-users-page',
  imports: [
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="People who sign in to this organization. Access comes from their roles."
      i18n-subtitle="@@users.subtitle"
    >
      <a
        *appHasPermission="'users.create'"
        mat-flat-button
        routerLink="/app/administration/users/new"
      >
        <mat-icon aria-hidden="true">person_add</mat-icon>
        <span i18n="@@users.create">New user</span>
      </a>
    </app-page-header>

    <div class="toolbar">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label i18n="@@common.search">Search</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" type="search" />
      </mat-form-field>
      <mat-slide-toggle
        [ngModel]="showInactive()"
        (ngModelChange)="showInactive.set($event)"
        i18n="@@common.showInactive"
      >
        Show inactive
      </mat-slide-toggle>
    </div>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (visible().length === 0) {
      <app-state-panel icon="group" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="visible()" class="data-table">
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef i18n="@@users.email">Email</th>
            <td mat-cell *matCellDef="let user">
              <a [routerLink]="['/app/administration/users', user.id]">{{ user.email }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@users.name">Name</th>
            <td mat-cell *matCellDef="let user">{{ user.firstName }} {{ user.lastName }}</td>
          </ng-container>
          <ng-container matColumnDef="roles">
            <th mat-header-cell *matHeaderCellDef i18n="@@users.roles">Roles</th>
            <td mat-cell *matCellDef="let user">
              <span class="muted">{{
                user.roles.length ? user.roles.join(', ') : noRolesLabel
              }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let user">
              <app-status-chip
                [label]="user.isActive ? activeLabel : inactiveLabel"
                [tone]="user.isActive ? 'success' : 'neutral'"
              />
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
export class UsersPage {
  private readonly api = inject(UsersApiService);

  readonly heading = $localize`:@@users.heading:Users`;
  readonly errorTitle = $localize`:@@users.loadFailed:We could not load users`;
  readonly emptyTitle = $localize`:@@users.empty.title:No users match`;
  readonly emptyMessage = $localize`:@@users.empty.message:Try another search, or add a user.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly noRolesLabel = $localize`:@@users.noRoles:No roles`;
  readonly columns = ['email', 'name', 'roles', 'status'];

  readonly users = signal<UserSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly search = signal('');
  readonly showInactive = signal(true);

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.users().filter(
      (user) =>
        (this.showInactive() || user.isActive) &&
        (term.length === 0 ||
          `${user.email} ${user.firstName} ${user.lastName}`.toLowerCase().includes(term)),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@users.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }
}
