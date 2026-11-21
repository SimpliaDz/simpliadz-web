import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PagerComponent } from '../../../../shared/ui/pager/pager.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import {
  Location,
  LocationsApiService,
} from '../../../inventory/locations/data-access/locations-api.service';
import { Expense, ExpenseCategory, ExpensesApiService } from '../data-access/expenses-api.service';
import { ExpenseDialogComponent, ExpenseDialogData } from '../ui/expense-dialog.component';

const pageSize = 50;

@Component({
  selector: 'app-expenses-page',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    PagerComponent,
    RouterLink,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Money spent to run the business. Expenses are corrected by editing, never deleted."
      i18n-subtitle="@@expenses.subtitle"
    >
      <a
        *appHasPermission="'expense-categories.view'"
        mat-stroked-button
        routerLink="/app/accounting/expense-categories"
      >
        <span i18n="@@expenses.categories">Categories</span>
      </a>
      <button
        *appHasPermission="'expenses.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@expenses.create">New expense</span>
      </button>
    </app-page-header>

    <form class="toolbar" (ngSubmit)="applyFilters()" role="search">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.from">From</mat-label>
        <input matInput type="date" name="from" [(ngModel)]="fromDate" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.to">To</mat-label>
        <input matInput type="date" name="to" [(ngModel)]="toDate" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@expenses.field.category">Category</mat-label>
        <mat-select name="category" [(ngModel)]="categoryId">
          <mat-option [value]="null" i18n="@@common.all">All</mat-option>
          @for (category of categories(); track category.id) {
            <mat-option [value]="category.id">{{ category.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <button mat-stroked-button type="submit" i18n="@@common.apply">Apply</button>
    </form>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (expenses().length === 0) {
      <app-state-panel icon="receipt" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <p class="total-line">
        <span i18n="@@expenses.pageTotal">Total on this page</span>:
        <strong>{{ pageTotal() | number: '1.2-2' }}</strong>
      </p>
      <div class="table-card">
        <table mat-table [dataSource]="expenses()" class="data-table">
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef i18n="@@expenses.field.date">Date</th>
            <td mat-cell *matCellDef="let row">{{ row.expenseDate | date: 'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef i18n="@@expenses.field.category">Category</th>
            <td mat-cell *matCellDef="let row">{{ categoryName(row.expenseCategoryId) }}</td>
          </ng-container>
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef i18n="@@expenses.field.description">
              Description
            </th>
            <td mat-cell *matCellDef="let row" class="muted">{{ row.description ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef i18n="@@expenses.field.amount">Amount</th>
            <td mat-cell *matCellDef="let row">{{ row.amount | number: '1.2-2' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button
                *appHasPermission="'expenses.manage'"
                mat-icon-button
                type="button"
                (click)="openDialog(row)"
                [attr.aria-label]="editLabel + ' ' + categoryName(row.expenseCategoryId)"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
      <app-pager [page]="page()" [hasNext]="hasNext()" (pageChange)="goTo($event)" />
    }
  `,
  styles: `
    .total-line {
      text-align: end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesPage {
  private readonly api = inject(ExpensesApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);

  readonly heading = $localize`:@@expenses.heading:Expenses`;
  readonly errorTitle = $localize`:@@expenses.loadFailed:We could not load expenses`;
  readonly emptyTitle = $localize`:@@expenses.empty.title:No expenses match`;
  readonly emptyMessage = $localize`:@@expenses.empty.message:Record an expense to keep track of running costs.`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly columns = ['date', 'category', 'description', 'amount', 'actions'];

  readonly canManage = computed(() => this.session.hasPermission('expenses.manage'));
  readonly expenses = signal<Expense[]>([]);
  readonly categories = signal<ExpenseCategory[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly pageTotal = computed(() =>
    this.expenses().reduce((sum, expense) => sum + expense.amount, 0),
  );

  fromDate: string | null = null;
  toDate: string | null = null;
  categoryId: string | null = null;
  private active = {
    fromDate: null as string | null,
    toDate: null as string | null,
    categoryId: null as string | null,
  };

  constructor() {
    this.load();
  }

  applyFilters(): void {
    this.active = { fromDate: this.fromDate, toDate: this.toDate, categoryId: this.categoryId };
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      expenses: this.api.list({
        fromDate: this.active.fromDate,
        toDate: this.active.toDate,
        expenseCategoryId: this.active.categoryId,
        locationId: null,
        page: this.page(),
        pageSize,
      }),
      categories: this.api.categories(null),
      locations: this.locationsApi.list(),
    }).subscribe({
      next: ({ expenses, categories, locations }) => {
        this.expenses.set(expenses);
        this.categories.set(categories);
        this.locations.set(locations);
        this.hasNext.set(expenses.length === pageSize);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@expenses.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  openDialog(expense: Expense | null): void {
    const data: ExpenseDialogData = {
      expense,
      categories: this.categories().filter(
        (category) => category.isActive || category.id === expense?.expenseCategoryId,
      ),
      locations: this.locations(),
    };
    this.dialog
      .open(ExpenseDialogComponent, { data, width: '34rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@expenses.saved:Expense saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  categoryName(id: string): string {
    return this.categories().find((category) => category.id === id)?.name ?? id;
  }
}
