import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { ExpenseCategory, ExpensesApiService } from '../data-access/expenses-api.service';
import {
  ExpenseCategoryDialogComponent,
  ExpenseCategoryDialogData,
} from '../ui/expense-category-dialog.component';

@Component({
  selector: 'app-expense-categories-page',
  imports: [
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
      subtitle="Groups for expenses, such as rent, utilities or transport."
      i18n-subtitle="@@expenseCategories.subtitle"
      [backLink]="backLink"
    >
      <button
        *appHasPermission="'expense-categories.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@expenseCategories.create">New category</span>
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
    } @else if (categories().length === 0) {
      <app-state-panel icon="category" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="categories()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let row">{{ row.name }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-chip
                [label]="row.isActive ? activeLabel : inactiveLabel"
                [tone]="row.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button
                *appHasPermission="'expense-categories.manage'"
                mat-icon-button
                type="button"
                (click)="openDialog(row)"
                [attr.aria-label]="editLabel + ' ' + row.name"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              @if (row.isActive) {
                <button
                  *appHasPermission="'expense-categories.manage'"
                  mat-icon-button
                  type="button"
                  (click)="deactivate(row)"
                  [attr.aria-label]="deactivateLabel + ' ' + row.name"
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
export class ExpenseCategoriesPage {
  private readonly api = inject(ExpensesApiService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@expenseCategories.heading:Expense categories`;
  readonly backLink = {
    label: $localize`:@@expenses.backToList:All expenses`,
    path: '/app/accounting/expenses',
  };
  readonly errorTitle = $localize`:@@expenseCategories.loadFailed:We could not load categories`;
  readonly emptyTitle = $localize`:@@expenseCategories.empty.title:No categories yet`;
  readonly emptyMessage = $localize`:@@expenseCategories.empty.message:Create a category so expenses can be grouped.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;
  readonly columns = ['name', 'status', 'actions'];

  readonly categories = signal<ExpenseCategory[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.categories(null).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@expenseCategories.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  openDialog(category: ExpenseCategory | null): void {
    const data: ExpenseCategoryDialogData = { category };
    this.dialog
      .open(ExpenseCategoryDialogComponent, { data, width: '28rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@expenseCategories.saved:Category saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  deactivate(category: ExpenseCategory): void {
    this.confirm
      .confirm({
        title: $localize`:@@expenseCategories.deactivate.title:Deactivate category?`,
        message: $localize`:@@expenseCategories.deactivate.message:Existing expenses keep this category. It can no longer be used for new expenses. Categories cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivateCategory(category.id).subscribe({
          next: () => {
            this.snackBar.open(
              $localize`:@@expenseCategories.deactivated:Category deactivated.`,
              undefined,
              { duration: 3000 },
            );
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@expenseCategories.deactivateFailed:The category could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }
}
