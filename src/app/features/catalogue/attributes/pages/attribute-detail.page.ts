import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { numberOrNull } from '../../../../shared/forms/form-values';
import {
  Attribute,
  AttributesApiService,
  AttributeValue,
} from '../data-access/attributes-api.service';

@Component({
  selector: 'app-attribute-detail-page',
  imports: [
    HasPermissionDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    StatePanelComponent,
  ],
  template: `
    <app-page-header [title]="attribute()?.name ?? heading" [backLink]="backLink">
      <span class="muted" i18n="@@attributes.detail.note"
        >Attribute names are fixed after creation.</span
      >
    </app-page-header>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (attribute(); as current) {
      <h2 class="section-title" i18n="@@attributes.values">Values</h2>

      @if (current.values.length === 0) {
        <p class="muted" i18n="@@attributes.noValuesHint">
          No values yet. Add the first value below.
        </p>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="current.values" class="data-table">
            <ng-container matColumnDef="value">
              <th mat-header-cell *matHeaderCellDef i18n="@@attributes.value.field">Value</th>
              <td mat-cell *matCellDef="let row">{{ row.value }}</td>
            </ng-container>
            <ng-container matColumnDef="order">
              <th mat-header-cell *matHeaderCellDef i18n="@@attributes.displayOrder">
                Display order
              </th>
              <td mat-cell *matCellDef="let row">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="order-field">
                  <mat-label i18n="@@attributes.displayOrder">Display order</mat-label>
                  <input
                    matInput
                    type="number"
                    min="0"
                    [value]="orderDraft(row)"
                    (input)="setOrderDraft(row.id, $any($event.target).value)"
                    [attr.aria-label]="row.value + ' display order'"
                  />
                </mat-form-field>
                <button
                  *appHasPermission="'attributes.manage'"
                  mat-stroked-button
                  type="button"
                  (click)="saveOrder(row)"
                  i18n="@@common.save"
                >
                  Save
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="valueColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: valueColumns"></tr>
          </table>
        </div>
      }

      @if (canManage()) {
        <h2 class="section-title" i18n="@@attributes.addValue">Add a value</h2>
        <form class="form-grid" [formGroup]="valueForm" (ngSubmit)="addValue()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@attributes.value.field">Value</mat-label>
            <input matInput formControlName="value" maxlength="150" />
            @if (valueForm.controls.value.hasError('required')) {
              <mat-error i18n="@@validation.required">This field is required.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@attributes.displayOrder">Display order</mat-label>
            <input matInput type="number" min="0" formControlName="displayOrder" />
            @if (valueForm.controls.displayOrder.hasError('min')) {
              <mat-error i18n="@@validation.nonNegative">Use zero or a positive number.</mat-error>
            }
          </mat-form-field>
          @if (valueError(); as message) {
            <p class="form-error full-row" role="alert">{{ message }}</p>
          }
          <div class="form-actions full-row">
            <button mat-flat-button type="submit" [disabled]="savingValue()">
              <span i18n="@@common.add">Add value</span>
            </button>
          </div>
        </form>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttributeDetailPage {
  private readonly api = inject(AttributesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);
  private readonly attributeId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly heading = $localize`:@@attributes.detail.heading:Attribute`;
  readonly errorTitle = $localize`:@@attributes.detail.loadFailed:We could not load this attribute`;
  readonly backLink = {
    label: $localize`:@@attributes.backToList:All attributes`,
    path: '/app/catalogue/attributes',
  };
  readonly valueColumns = ['value', 'order'];

  readonly attribute = signal<Attribute | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly savingValue = signal(false);
  readonly valueError = signal<string | null>(null);
  readonly orderDrafts = signal<Record<string, number>>({});

  readonly valueForm = this.formBuilder.group({
    value: ['', [Validators.required, Validators.maxLength(150)]],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.load();
  }

  canManage(): boolean {
    return this.session.hasPermission('attributes.manage');
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.get(this.attributeId).subscribe({
      next: (attribute) => {
        this.attribute.set(attribute);
        this.orderDrafts.set(
          Object.fromEntries(attribute.values.map((value) => [value.id, value.displayOrder])),
        );
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@attributes.detail.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  orderDraft(value: AttributeValue): number {
    return this.orderDrafts()[value.id] ?? value.displayOrder;
  }

  setOrderDraft(valueId: string, raw: string): void {
    const parsed = numberOrNull(raw);
    if (parsed !== null) {
      this.orderDrafts.update((drafts) => ({ ...drafts, [valueId]: parsed }));
    }
  }

  saveOrder(value: AttributeValue): void {
    const order = this.orderDraft(value);
    if (order < 0) {
      this.snackBar.open(
        $localize`:@@validation.nonNegative:Use zero or a positive number.`,
        undefined,
        { duration: 4000 },
      );
      return;
    }
    this.api.reorderValue(this.attributeId, value.id, order).subscribe({
      next: () => {
        this.snackBar.open($localize`:@@attributes.orderSaved:Display order saved.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) =>
        this.snackBar.open(
          describeApiError(
            error,
            $localize`:@@attributes.orderFailed:The display order could not be saved.`,
          ),
          undefined,
          { duration: 5000 },
        ),
    });
  }

  addValue(): void {
    if (this.valueForm.invalid) {
      this.valueForm.markAllAsTouched();
      return;
    }
    const value = this.valueForm.getRawValue();
    this.savingValue.set(true);
    this.valueError.set(null);
    this.api.addValue(this.attributeId, value.value.trim(), value.displayOrder).subscribe({
      next: () => {
        this.savingValue.set(false);
        this.valueForm.reset({ value: '', displayOrder: value.displayOrder + 1 });
        this.load();
      },
      error: (error: unknown) => {
        this.savingValue.set(false);
        this.valueError.set(
          describeApiError(error, $localize`:@@attributes.valueFailed:We could not add the value.`),
        );
      },
    });
  }
}
