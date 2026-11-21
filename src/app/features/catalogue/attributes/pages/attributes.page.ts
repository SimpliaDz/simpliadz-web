import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { Attribute, AttributesApiService } from '../data-access/attributes-api.service';
import { AttributeDialogComponent } from '../ui/attribute-dialog.component';

@Component({
  selector: 'app-attributes-page',
  imports: [
    HasPermissionDirective,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
  ],
  template: `
    <app-page-header
      [title]="heading"
      subtitle="Attributes such as color or size define the options a variant can take."
      i18n-subtitle="@@attributes.subtitle"
    >
      <button
        *appHasPermission="'attributes.manage'"
        mat-flat-button
        type="button"
        (click)="openCreate()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        <span i18n="@@attributes.create">New attribute</span>
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
    } @else if (attributes().length === 0) {
      <app-state-panel icon="tune" [title]="emptyTitle" [message]="emptyMessage" />
    } @else {
      <div class="table-card">
        <table mat-table [dataSource]="attributes()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef i18n="@@common.name">Name</th>
            <td mat-cell *matCellDef="let attribute">{{ attribute.name }}</td>
          </ng-container>
          <ng-container matColumnDef="values">
            <th mat-header-cell *matHeaderCellDef i18n="@@attributes.values">Values</th>
            <td mat-cell *matCellDef="let attribute">
              <span class="muted">{{ valuesSummary(attribute) }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden" i18n="@@common.actions">Actions</span>
            </th>
            <td mat-cell *matCellDef="let attribute" class="actions-cell">
              <a mat-stroked-button [routerLink]="['/app/catalogue/attributes', attribute.id]">
                <span i18n="@@common.viewDetails">View</span>
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
export class AttributesPage {
  private readonly api = inject(AttributesApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly heading = $localize`:@@attributes.heading:Attributes`;
  readonly errorTitle = $localize`:@@attributes.loadFailed:We could not load attributes`;
  readonly emptyTitle = $localize`:@@attributes.empty.title:No attributes yet`;
  readonly emptyMessage = $localize`:@@attributes.empty.message:Create an attribute such as Color, then add its values.`;

  readonly columns = ['name', 'values', 'actions'];
  readonly attributes = signal<Attribute[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (attributes) => {
        this.attributes.set(attributes);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(error, $localize`:@@attributes.loadFailedHint:Try again in a moment.`),
        );
      },
    });
  }

  valuesSummary(attribute: Attribute): string {
    return attribute.values.length === 0
      ? $localize`:@@attributes.noValues:No values yet`
      : attribute.values.map((value) => value.value).join(', ');
  }

  openCreate(): void {
    this.dialog
      .open(AttributeDialogComponent, { width: '28rem', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open($localize`:@@attributes.saved:Attribute created.`, undefined, {
            duration: 3000,
          });
          this.load();
        }
      });
  }
}
