import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import {
  openDocumentWindow,
  writeDocumentWindow,
} from '../../../../shared/documents/html-document-window';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import { Location, LocationsApiService } from '../../locations/data-access/locations-api.service';
import {
  DocumentTemplate,
  DocumentsApiService,
  documentTypeFromNumber,
} from '../data-access/documents-api.service';
import {
  DocumentTemplateDialogComponent,
  DocumentTemplateDialogData,
} from '../ui/document-template-dialog.component';

@Component({
  selector: 'app-documents-page',
  imports: [
    FormsModule,
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    PageHeaderComponent,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Printable stock lists and count documents. Templates decide the columns and paper."
      i18n-subtitle="@@documents.subtitle"
    >
      <button
        *appHasPermission="'inventory-documents.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@documents.create">New template</span>
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
    } @else {
      <h2 class="section-title" i18n="@@documents.print.stockList">Print a stock list</h2>
      @if (canPrint()) {
        <form class="toolbar" (ngSubmit)="printStockList()" role="form">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@documents.template">Template</mat-label>
            <mat-select name="template" [(ngModel)]="templateId" required>
              @for (template of stockListTemplates(); track template.id) {
                <mat-option [value]="template.id">{{ template.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@stock.field.location">Location</mat-label>
            <mat-select name="location" [(ngModel)]="locationId" required>
              @for (location of locations(); track location.id) {
                <mat-option [value]="location.id">{{ location.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-slide-toggle name="zero" [(ngModel)]="includeZero" i18n="@@documents.includeZero"
            >Include zero stock</mat-slide-toggle
          >
          <button
            mat-flat-button
            type="submit"
            [disabled]="busy() || !templateId || !locationId"
            i18n="@@documents.print.action"
          >
            Open for printing
          </button>
        </form>
        <p class="form-hint" i18n="@@documents.limit">A stock list is limited to 5,000 rows.</p>
      } @else {
        <p class="muted" i18n="@@documents.noPrint">
          You need the print permission to open documents.
        </p>
      }

      <h2 class="section-title" i18n="@@documents.templates">Templates</h2>
      @if (templates().length === 0) {
        <app-state-panel icon="description" [title]="emptyTitle" [message]="emptyMessage" />
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="templates()" class="data-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
              <td mat-cell *matCellDef="let row">{{ row.name }}</td>
            </ng-container>
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef i18n="@@documents.field.type">Document type</th>
              <td mat-cell *matCellDef="let row">{{ typeLabel(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="paper">
              <th mat-header-cell *matHeaderCellDef i18n="@@documents.paperHeader">Paper</th>
              <td mat-cell *matCellDef="let row">
                {{ row.paperSize }}{{ row.landscape ? ' · ' + landscapeLabel : '' }}
              </td>
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
                @if (row.isActive) {
                  <button
                    *appHasPermission="'inventory-documents.manage'"
                    mat-icon-button
                    type="button"
                    (click)="openDialog(row)"
                    [attr.aria-label]="editLabel + ' ' + row.name"
                  >
                    <mat-icon aria-hidden="true">edit</mat-icon>
                  </button>
                  <button
                    *appHasPermission="'inventory-documents.manage'"
                    mat-icon-button
                    type="button"
                    (click)="deactivate(row)"
                    [attr.aria-label]="deactivateLabel + ' ' + row.name"
                  >
                    <mat-icon aria-hidden="true">block</mat-icon>
                  </button>
                } @else {
                  <button *appHasPermission="'inventory-documents.manage'" mat-button type="button"
                    (click)="activate(row)">Activate</button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {
  private readonly api = inject(DocumentsApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@documents.heading:Inventory documents`;
  readonly errorTitle = $localize`:@@documents.loadFailed:We could not load document templates`;
  readonly emptyTitle = $localize`:@@documents.empty.title:No templates yet`;
  readonly emptyMessage = $localize`:@@documents.empty.message:Create a template to choose columns and paper for printed stock lists.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly deactivateLabel = $localize`:@@common.deactivate:Deactivate`;
  readonly landscapeLabel = $localize`:@@documents.landscape:landscape`;
  readonly columns = ['name', 'type', 'paper', 'status', 'actions'];

  readonly canPrint = computed(() => this.session.hasPermission('inventory-documents.print'));
  readonly templates = signal<DocumentTemplate[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly stockListTemplates = computed(() =>
    this.templates().filter((t) => t.isActive && documentTypeFromNumber[t.type] === 'StockList'),
  );

  templateId: string | null = null;
  locationId: string | null = null;
  includeZero = false;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ templates: this.api.templates(), locations: this.locationsApi.list() }).subscribe({
      next: ({ templates, locations }) => {
        this.templates.set(templates);
        this.locations.set(locations);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@documents.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  activate(template: DocumentTemplate): void {
    this.api.activateTemplate(template.id).subscribe({
      next: () => this.load(),
      error: error => this.snackBar.open(describeApiError(error, 'Could not activate the template.'), undefined, { duration: 5000 }),
    });
  }

  printStockList(): void {
    if (!this.templateId || !this.locationId) {
      return;
    }
    // Open the window inside the click so the popup blocker allows it; fill it when the HTML arrives.
    const win = openDocumentWindow();
    this.busy.set(true);
    this.api.stockListHtml(this.templateId, this.locationId, this.includeZero).subscribe({
      next: (html) => {
        this.busy.set(false);
        if (!writeDocumentWindow(win, html)) {
          this.snackBar.open(
            $localize`:@@documents.popup:Allow pop-ups for this site to open the document.`,
            undefined,
            { duration: 5000 },
          );
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        win?.close();
        this.snackBar.open(
          describeApiError(
            error,
            $localize`:@@documents.printFailed:The document could not be created.`,
          ),
          undefined,
          { duration: 6000 },
        );
      },
    });
  }

  openDialog(template: DocumentTemplate | null): void {
    const data: DocumentTemplateDialogData = { template };
    this.dialog
      .open(DocumentTemplateDialogComponent, { data, width: '36rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@documents.saved:Template saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  deactivate(template: DocumentTemplate): void {
    this.confirm
      .confirm({
        title: $localize`:@@documents.deactivate.title:Deactivate template?`,
        message: $localize`:@@documents.deactivate.message:The template can no longer be used for printing.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivateTemplate(template.id).subscribe({
          next: () => this.load(),
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@documents.deactivateFailed:The template could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }

  typeLabel(template: DocumentTemplate): string {
    switch (documentTypeFromNumber[template.type]) {
      case 'CountSheet':
        return $localize`:@@documents.type.countSheet:Count sheet`;
      case 'CountDifferences':
        return $localize`:@@documents.type.differences:Count differences`;
      default:
        return $localize`:@@documents.type.stockList:Stock list`;
    }
  }
}
