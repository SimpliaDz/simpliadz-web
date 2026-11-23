import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { CategoriesApiService, CategoryNode } from '../data-access/categories-api.service';
import { CategoryDialogComponent, ParentOption } from '../ui/category-dialog.component';

interface CategoryRow {
  readonly node: CategoryNode;
  readonly depth: number;
}

function flatten(nodes: readonly CategoryNode[], depth = 0): CategoryRow[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

function descendantIds(node: CategoryNode): string[] {
  return node.children.flatMap((child) => [child.id, ...descendantIds(child)]);
}

@Component({
  selector: 'app-categories-page',
  imports: [
    DatePipe,
    HasPermissionDirective,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Group products into a tree. Products can sit under any category."
      i18n-subtitle="@@categories.subtitle"
    >
      <button
        *appHasPermission="'categories.create'"
        mat-flat-button
        type="button"
        (click)="openCreate()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@categories.create">New category</span>
      </button>
    </app-page-header>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (rows().length === 0) {
      <app-state-panel icon="account_tree" [title]="emptyTitle" [message]="emptyMessage">
        <button
          *appHasPermission="'categories.create'"
          mat-flat-button
          type="button"
          (click)="openCreate()"
          i18n="@@categories.create"
        >
          New category
        </button>
      </app-state-panel>
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="rows()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let row">
              <span [style.padding-inline-start.rem]="row.depth * 1.5">{{ row.node.name }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-chip
                [label]="row.node.isActive ? activeLabel : inactiveLabel"
                [tone]="row.node.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="updated">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.updated">Updated</th>
            <td mat-cell *matCellDef="let row">{{ row.node.updatedAt | date: 'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button
                *appHasPermission="'categories.edit'"
                mat-icon-button
                type="button"
                (click)="openEdit(row.node)"
                [attr.aria-label]="editLabel + ' ' + row.node.name"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              @if (row.node.isActive) {
                <button
                  *appHasPermission="'categories.edit'"
                  mat-icon-button
                  type="button"
                  (click)="deactivate(row.node)"
                  [attr.aria-label]="deactivateLabel + ' ' + row.node.name"
                >
                  <mat-icon aria-hidden="true">block</mat-icon>
                </button>
              } @else {
                <button *appHasPermission="'categories.edit'" mat-icon-button type="button" (click)="activate(row.node)" [attr.aria-label]="activateLabel + ' ' + row.node.name">
                  <mat-icon aria-hidden="true">check_circle</mat-icon>
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
export class CategoriesPage {
  private readonly api = inject(CategoriesApiService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@categories.heading:Categories`;
  readonly errorTitle = $localize`:@@categories.loadFailed:We could not load categories`;
  readonly emptyTitle = $localize`:@@categories.empty.title:No categories yet`;
  readonly emptyMessage = $localize`:@@categories.empty.message:Create a top-level category, then nest subcategories under it.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;
  readonly activateLabel = $localize`:@@common.activate:Activate`;

  readonly columns = ['name', 'status', 'updated', 'actions'];
  readonly tree = signal<CategoryNode[]>([]);
  readonly rows = computed(() => flatten(this.tree()));
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.tree().subscribe({
      next: (tree) => {
        this.tree.set(tree);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@categories.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  openCreate(): void {
    this.openDialog(null);
  }

  openEdit(node: CategoryNode): void {
    this.openDialog(node);
  }

  deactivate(node: CategoryNode): void {
    this.confirm
      .confirm({
        title: $localize`:@@categories.deactivate.title:Deactivate category?`,
        message: $localize`:@@categories.deactivate.message:Subcategories and products keep their links. The category can no longer be chosen for new products.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivate(node.id).subscribe({
          next: () => {
            this.snackBar.open(
              $localize`:@@categories.deactivated:Category deactivated.`,
              undefined,
              { duration: 3000 },
            );
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@categories.deactivateFailed:The category could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }

  activate(node: CategoryNode): void {
    this.api.activate(node.id).subscribe({ next: () => { this.snackBar.open($localize`:@@categories.activated:Category activated.`, undefined, { duration: 3000 }); this.load(); }, error: (error: unknown) => this.snackBar.open(describeApiError(error, $localize`:@@categories.activateFailed:The category could not be activated.`), undefined, { duration: 5000 }) });
  }

  private openDialog(node: CategoryNode | null): void {
    const excluded = new Set<string>(node ? [node.id, ...descendantIds(node)] : []);
    const parentOptions: ParentOption[] = this.rows()
      .filter((row) => !excluded.has(row.node.id))
      .map((row) => ({
        id: row.node.id,
        label: `${'— '.repeat(row.depth)}${row.node.name}`,
      }));

    this.dialog
      .open(CategoryDialogComponent, {
        data: { category: node, parentOptions },
        width: '32rem',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@categories.saved:Category saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }
}
