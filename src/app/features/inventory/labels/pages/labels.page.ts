import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
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
import { numberOrNull } from '../../../../shared/forms/form-values';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import {
  VariantCatalogueService,
  VariantOption,
} from '../../stock/data-access/variant-catalogue.service';
import { LabelPrintLine, LabelTemplate, LabelsApiService } from '../data-access/labels-api.service';
import {
  LabelTemplateDialogComponent,
  LabelTemplateDialogData,
} from '../ui/label-template-dialog.component';

interface LineDraft {
  readonly variantId: string;
  readonly quantity: number;
}

@Component({
  selector: 'app-labels-page',
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
      subtitle="Barcode labels for shelf and product tags. Variants must have a barcode to print."
      i18n-subtitle="@@labels.subtitle"
    >
      <button
        *appHasPermission="'barcode-labels.manage'"
        mat-flat-button
        type="button"
        (click)="openDialog(null)"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@labels.create">New label template</span>
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
      <h2 class="section-title" i18n="@@labels.print.title">Print labels</h2>
      @if (canPrint() && activeTemplates().length) {
        <form class="form-surface" (ngSubmit)="print()" role="form">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@labels.template">Label template</mat-label>
              <mat-select name="template" [(ngModel)]="templateId" required>
                @for (template of activeTemplates(); track template.id) {
                  <mat-option [value]="template.id">{{ template.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@stock.field.variant">Product variant</mat-label>
              <mat-select name="variant" [(ngModel)]="draftVariantId">
                @for (variant of variants(); track variant.id) {
                  <mat-option [value]="variant.id" [disabled]="!variant.isActive">{{
                    variant.label
                  }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@labels.copies">Labels</mat-label>
              <input
                matInput
                type="number"
                min="1"
                step="1"
                name="copies"
                [(ngModel)]="draftQuantity"
              />
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button
              mat-stroked-button
              type="button"
              (click)="addLine()"
              [disabled]="!draftVariantId"
              i18n="@@labels.addLine"
            >
              Add to print list
            </button>
          </div>

          @if (lines().length) {
            <ul class="line-list">
              @for (line of lines(); track $index) {
                <li>
                  <span>{{ variantLabel(line.variantId) }} × {{ line.quantity }}</span>
                  <button
                    mat-button
                    type="button"
                    (click)="removeLine($index)"
                    i18n="@@common.remove"
                  >
                    Remove
                  </button>
                </li>
              }
            </ul>
          }

          <mat-slide-toggle [(ngModel)]="showPrice" name="showPrice" i18n="@@labels.showPrice">
            Show price on label
          </mat-slide-toggle>
          <div class="form-actions">
            <button
              mat-flat-button
              type="submit"
              [disabled]="busy() || lines().length === 0 || !templateId"
              i18n="@@labels.print.action"
            >
              Open for printing
            </button>
          </div>
          <p class="form-hint" i18n="@@labels.limit">
            A print run is limited to 500 labels in total.
          </p>
        </form>
      } @else if (!canPrint()) {
        <p class="muted" i18n="@@labels.noPrint">You need the print permission to print labels.</p>
      } @else {
        <p class="muted" i18n="@@labels.noTemplate">
          Create an active label template before printing.
        </p>
      }

      <h2 class="section-title" i18n="@@labels.templates">Templates</h2>
      @if (templates().length === 0) {
        <app-state-panel icon="qr_code_2" [title]="emptyTitle" [message]="emptyMessage" />
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="templates()" class="data-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
              <td mat-cell *matCellDef="let row">{{ row.name }}</td>
            </ng-container>
            <ng-container matColumnDef="size">
              <th mat-header-cell *matHeaderCellDef i18n="@@labels.size">Label size</th>
              <td mat-cell *matCellDef="let row">
                {{ row.labelWidthMm }} × {{ row.labelHeightMm }} mm
              </td>
            </ng-container>
            <ng-container matColumnDef="page">
              <th mat-header-cell *matHeaderCellDef i18n="@@labels.page">Page</th>
              <td mat-cell *matCellDef="let row">
                {{ row.pageWidthMm }} × {{ row.pageHeightMm }} mm
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
                    *appHasPermission="'barcode-labels.manage'"
                    mat-icon-button
                    type="button"
                    (click)="openDialog(row)"
                    [attr.aria-label]="editLabel + ' ' + row.name"
                  >
                    <mat-icon aria-hidden="true">edit</mat-icon>
                  </button>
                } @else {
                  <button *appHasPermission="'barcode-labels.manage'" mat-button type="button"
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
  styles: `
    .line-list {
      display: grid;
      gap: 0.25rem;
      margin: 0 0 1rem;
      padding: 0;
      list-style: none;
    }
    .line-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelsPage {
  private readonly api = inject(LabelsApiService);
  private readonly catalogue = inject(VariantCatalogueService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@labels.heading:Barcode labels`;
  readonly errorTitle = $localize`:@@labels.loadFailed:We could not load label templates`;
  readonly emptyTitle = $localize`:@@labels.empty.title:No label templates`;
  readonly emptyMessage = $localize`:@@labels.empty.message:Create a template that matches your label sheet or printer.`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly editLabel = $localize`:@@common.edit:Edit`;
  readonly columns = ['name', 'size', 'page', 'status', 'actions'];

  private readonly locale = inject(LOCALE_ID);
  showPrice = false;

  readonly canPrint = computed(() => this.session.hasPermission('barcode-labels.print'));
  readonly templates = signal<LabelTemplate[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly lines = signal<LineDraft[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly activeTemplates = computed(() =>
    this.templates().filter((template) => template.isActive),
  );

  templateId: string | null = null;
  draftVariantId: string | null = null;
  draftQuantity: number | null = 1;
  private variantNames = new Map<string, string>();

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ templates: this.api.templates(), variants: this.catalogue.options() }).subscribe({
      next: ({ templates, variants }) => {
        this.templates.set(templates);
        this.variants.set(variants);
        this.variantNames = new Map(variants.map((variant) => [variant.id, variant.label]));
        this.templateId ??= templates.find((template) => template.isActive)?.id ?? null;
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@labels.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  activate(template: LabelTemplate): void {
    this.api.activateTemplate(template.id).subscribe({
      next: () => this.load(),
      error: error => this.snackBar.open(describeApiError(error, 'Could not activate the template.'), undefined, { duration: 5000 }),
    });
  }

  addLine(): void {
    const quantity = numberOrNull(this.draftQuantity);
    if (!this.draftVariantId || quantity === null || quantity < 1 || !Number.isInteger(quantity)) {
      this.snackBar.open($localize`:@@labels.quantity:Enter at least one label.`, undefined, {
        duration: 4000,
      });
      return;
    }
    this.lines.update((lines) => [
      ...lines,
      { variantId: this.draftVariantId as string, quantity },
    ]);
    this.draftVariantId = null;
    this.draftQuantity = 1;
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, position) => position !== index));
  }

  print(): void {
    if (!this.templateId || this.lines().length === 0) {
      return;
    }
    const payload: LabelPrintLine[] = this.lines().map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
    }));
    const win = openDocumentWindow();
    this.busy.set(true);
    this.api.printHtml(this.templateId, payload, this.showPrice, this.locale.split('-')[0]).subscribe({
      next: (html) => {
        this.busy.set(false);
        if (!writeDocumentWindow(win, html)) {
          this.snackBar.open(
            $localize`:@@labels.popup:Allow pop-ups for this site to open the labels.`,
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
            $localize`:@@labels.printFailed:The labels could not be created.`,
          ),
          undefined,
          { duration: 6000 },
        );
      },
    });
  }

  openDialog(template: LabelTemplate | null): void {
    const data: LabelTemplateDialogData = { template };
    this.dialog
      .open(LabelTemplateDialogComponent, { data, width: '36rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@labels.saved:Label template saved.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }

  variantLabel(id: string): string {
    return this.variantNames.get(id) ?? id;
  }
}
