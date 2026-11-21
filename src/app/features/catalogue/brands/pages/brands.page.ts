import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Brand, BrandsApiService } from '../data-access/brands-api.service';
import { BrandDialogComponent } from '../ui/brand-dialog.component';

@Component({
  selector: 'app-brands-page',
  imports: [
    DatePipe,
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
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Brands group products and appear on product records."
      i18n-subtitle="@@brands.subtitle"
    >
      <button
        *appHasPermission="'brands.create'"
        mat-flat-button
        type="button"
        (click)="openCreate()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@brands.create">New brand</span>
      </button>
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
      <app-state-panel icon="sell" [title]="emptyTitle" [message]="emptyMessage">
        <button
          *appHasPermission="'brands.create'"
          mat-flat-button
          type="button"
          (click)="openCreate()"
          i18n="@@brands.create"
        >
          New brand
        </button>
      </app-state-panel>
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="visible()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let brand">{{ brand.name }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let brand">
              <app-status-chip
                [label]="brand.isActive ? activeLabel : inactiveLabel"
                [tone]="brand.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="updated">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.updated">Updated</th>
            <td mat-cell *matCellDef="let brand">{{ brand.updatedAt | date: 'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let brand" class="actions-cell">
              <button
                *appHasPermission="'brands.edit'"
                mat-icon-button
                type="button"
                (click)="openEdit(brand)"
                [attr.aria-label]="editLabel + ' ' + brand.name"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              @if (brand.isActive) {
                <button
                  *appHasPermission="'brands.edit'"
                  mat-icon-button
                  type="button"
                  (click)="deactivate(brand)"
                  [attr.aria-label]="deactivateLabel + ' ' + brand.name"
                >
                  <mat-icon aria-hidden="true">block</mat-icon>
                </button>
              }
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
export class BrandsPage {
  private readonly api = inject(BrandsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@brands.heading:Brands`;
  readonly errorTitle = $localize`:@@brands.loadFailed:We could not load brands`;
  readonly emptyTitle = $localize`:@@brands.empty.title:No brands yet`;
  readonly emptyMessage = $localize`:@@brands.empty.message:Add the brands you sell so products can be grouped by brand.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;

  readonly columns = ['name', 'status', 'updated', 'actions'];
  readonly brands = signal<Brand[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly search = signal('');
  readonly showInactive = signal(true);

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.brands().filter(
      (brand) =>
        (this.showInactive() || brand.isActive) &&
        (term.length === 0 || brand.name.toLowerCase().includes(term)),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (brands) => {
        this.brands.set(brands);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@brands.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  openCreate(): void {
    this.openDialog(null);
  }

  openEdit(brand: Brand): void {
    this.openDialog(brand);
  }

  deactivate(brand: Brand): void {
    this.confirm
      .confirm({
        title: $localize`:@@brands.deactivate.title:Deactivate brand?`,
        message: $localize`:@@brands.deactivate.message:Products keep this brand, but it can no longer be chosen for new products. Brands cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivate(brand.id).subscribe({
          next: () => {
            this.snackBar.open($localize`:@@brands.deactivated:Brand deactivated.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@brands.deactivateFailed:The brand could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }

  private openDialog(brand: Brand | null): void {
    this.dialog
      .open(BrandDialogComponent, { data: { brand }, width: '28rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@brands.saved:Brand saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }
}
