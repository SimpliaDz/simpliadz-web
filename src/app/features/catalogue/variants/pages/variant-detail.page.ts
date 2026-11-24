import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { HasPermissionDirective } from '../../../../core/auth/has-permission.directive';
import { blankToNull, numberOrNull } from '../../../../shared/forms/form-values';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import {
  PriceList,
  PriceListsApiService,
} from '../../../inventory/price-lists/data-access/price-lists-api.service';
import { Variant, VariantPrice, VariantsApiService } from '../data-access/variants-api.service';
import { ProductsApiService } from '../../products/data-access/products-api.service';
import { Attribute, AttributesApiService } from '../../attributes/data-access/attributes-api.service';
import { CategoriesApiService, CategoryNode } from '../../categories/data-access/categories-api.service';

interface PriceRow {
  readonly list: PriceList;
  readonly price: VariantPrice | null;
}
function findCategory(nodes: readonly CategoryNode[], id: string | null): CategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findCategory(node.children, id);
    if (nested) return nested;
  }
  return null;
}

@Component({
  selector: 'app-variant-detail-page',
  imports: [
    DecimalPipe,
    HasPermissionDirective,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    StatePanelComponent,
    StatusChipComponent,
  ],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="loading-bar" />
    } @else if (loadError(); as message) {
      <app-state-panel icon="error" tone="error" [title]="errorTitle" [message]="message">
        <button mat-stroked-button type="button" (click)="load()" i18n="@@common.retry">
          Try again
        </button>
      </app-state-panel>
    } @else if (variant(); as current) {
      <app-page-header [title]="current.sku" [backLink]="backLink()" [subtitle]="subtitle()">
        <app-status-chip
          [label]="current.isActive ? activeLabel : inactiveLabel"
          [tone]="current.isActive ? 'success' : 'neutral'"
        />
        @if (current.isActive) {
          <button
            *appHasPermission="'variants.edit'"
            mat-stroked-button
            type="button"
            (click)="deactivate(current)"
          >
            <mat-icon aria-hidden="true">block</mat-icon>
            <span i18n="@@common.deactivate">Deactivate</span>
          </button>
        }
      </app-page-header>

      <div class="card-grid">
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title i18n="@@variants.attributes">Attributes</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (current.attributeValues.length) {
              <ul class="chip-list">
                @for (item of current.attributeValues; track item.attributeValueId) {
                  <li>{{ item.attributeName }}: {{ item.value }}</li>
                }
              </ul>
            } @else {
              <p class="muted" i18n="@@variants.noAttributes">No attribute values.</p>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title i18n="@@variants.barcode">Barcode</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="barcode-value">{{ current.barcode ?? noBarcodeLabel }}</p>
            @if (!current.barcode && current.isActive) {
              <button
                *appHasPermission="'variants.edit'"
                mat-stroked-button
                type="button"
                (click)="generateBarcode(current)"
                [disabled]="busy()"
              >
                <mat-icon aria-hidden="true">qr_code_2</mat-icon>
                <span i18n="@@variants.generateBarcode">Generate barcode</span>
              </button>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <h2 class="section-title" i18n="@@variants.section.identifiers">Identifiers</h2>
      @if (canEditIdentifiers() && current.isActive) {
        <form
          [formGroup]="identifiers"
          (ngSubmit)="saveIdentifiers(current)"
          novalidate
          class="form-surface"
        >
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@variants.sku">SKU</mat-label>
              <input matInput formControlName="sku" maxlength="64" />
              @if (identifiers.controls.sku.hasError('required')) {
                <mat-error i18n="@@validation.required">This field is required.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@variants.barcode">Barcode</mat-label>
              <input matInput formControlName="barcode" maxlength="64" />
            </mat-form-field>
            @if (attributeSelections(); as selections) {
              <ng-container [formGroup]="selections">
                @for (attribute of attributes(); track attribute.id) {
                  <mat-form-field appearance="outline">
                    <mat-label>{{ attribute.name }}</mat-label>
                    <mat-select [formControlName]="attribute.id">
                      <mat-option value="" i18n="@@common.none">None</mat-option>
                      @for (value of attribute.values; track value.id) {
                        <mat-option [value]="value.id">{{ value.value }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                }
              </ng-container>
            }
          </div>
          <p class="form-hint" i18n="@@variants.auditNotice">
            Changes to SKU and barcode are recorded in the audit trail.
          </p>
          @if (identifierError(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }
          <div class="form-actions">
            <button mat-flat-button type="submit" [disabled]="busy()">
              <span i18n="@@common.save">Save</span>
            </button>
          </div>
        </form>
      } @else {
        <dl class="detail-list">
          <dt i18n="@@variants.sku">SKU</dt>
          <dd>{{ current.sku }}</dd>
          <dt i18n="@@variants.barcode">Barcode</dt>
          <dd>{{ current.barcode ?? '—' }}</dd>
        </dl>
      }

      <h2 class="section-title" i18n="@@variants.section.prices">Prices by price list</h2>
      @if (priceRows().length === 0) {
        <app-state-panel icon="sell" [title]="noListsTitle" [message]="noListsMessage" />
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="priceRows()" class="data-table">
            <ng-container matColumnDef="list">
              <th mat-header-cell *matHeaderCellDef i18n="@@priceLists.name">Price list</th>
              <td mat-cell *matCellDef="let row">
                {{ row.list.name }} <span class="muted">({{ row.list.type }})</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="currency">
              <th mat-header-cell *matHeaderCellDef i18n="@@priceLists.currency">Currency</th>
              <td mat-cell *matCellDef="let row">{{ row.list.currencyCode }}</td>
            </ng-container>
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef i18n="@@priceLists.price">Price</th>
              <td mat-cell *matCellDef="let row">
                @if (row.price; as price) {
                  {{ price.price | number: '1.2-4' }}
                } @else {
                  <span class="muted" i18n="@@priceLists.notPriced">Not priced</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="edit">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden" i18n="@@common.actions">Actions</span>
              </th>
              <td mat-cell *matCellDef="let row" class="actions-cell">
                @if (canEditPrices()) {
                  <mat-form-field
                    appearance="outline"
                    subscriptSizing="dynamic"
                    class="price-field"
                  >
                    <mat-label i18n="@@priceLists.newPrice">New price</mat-label>
                    <input
                      matInput
                      type="number"
                      min="0"
                      step="0.0001"
                      [formControl]="priceControl(row.list.id)"
                    />
                  </mat-form-field>
                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="busy()"
                    (click)="savePrice(row)"
                    [attr.aria-label]="savePriceLabel + ' ' + row.list.name"
                  >
                    <span i18n="@@common.save">Save</span>
                  </button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="priceColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: priceColumns"></tr>
          </table>
        </div>
      }
    }
  `,
  styles: `
    .barcode-value {
      font-family: var(--mat-sys-body-large-font, monospace);
      letter-spacing: 0.04em;
      word-break: break-all;
    }
    .price-field {
      width: 9rem;
      margin-inline-end: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantDetailPage {
  private readonly api = inject(VariantsApiService);
  private readonly priceListsApi = inject(PriceListsApiService);
  private readonly productsApi = inject(ProductsApiService);
  private readonly attributesApi = inject(AttributesApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly variantId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly errorTitle = $localize`:@@variants.detail.loadFailed:We could not load this variant`;
  readonly noBarcodeLabel = $localize`:@@variants.noBarcode:No barcode yet`;
  readonly activeLabel = $localize`:@@common.active:Active`;
  readonly inactiveLabel = $localize`:@@common.inactive:Inactive`;
  readonly savePriceLabel = $localize`:@@priceLists.savePrice:Save price for`;
  readonly noListsTitle = $localize`:@@variants.noLists.title:No price lists`;
  readonly noListsMessage = $localize`:@@variants.noLists.message:Create a price list before setting prices for this variant.`;
  readonly backLink = signal({
    label: $localize`:@@variants.backToProducts:All products`,
    path: '/app/catalogue/products',
  });
  readonly priceColumns = ['list', 'currency', 'price', 'edit'];

  readonly variant = signal<Variant | null>(null);
  readonly subtitle = signal<string | null>(null);
  readonly priceRows = signal<PriceRow[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly identifierError = signal<string | null>(null);
  readonly priceControls = new Map<string, FormControl<number | null>>();
  readonly attributes = signal<Attribute[]>([]);
  readonly attributeSelections = signal<FormGroup<Record<string, FormControl<string>>> | null>(null);

  readonly identifiers = this.formBuilder.group({
    sku: ['', [Validators.required, Validators.maxLength(64)]],
    barcode: ['', [Validators.maxLength(64)]],
  });

  constructor() {
    this.load();
  }

  canEditIdentifiers(): boolean {
    return this.session.hasPermission('variants.edit');
  }

  canEditPrices(): boolean {
    return this.session.hasPermission('price-lists.manage');
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api
      .get(this.variantId)
      .pipe(
        switchMap((variant) =>
          this.priceListsApi.list().pipe(
            switchMap((lists) =>
              lists.length === 0
                ? of<PriceRow[]>([])
                : forkJoin(
                    lists.map((list) =>
                      this.api
                        .getPrice(list.id, variant.id)
                        .pipe(map((price): PriceRow => ({ list, price }))),
                    ),
                  ),
            ),
            map((rows) => ({ variant, rows })),
          ),
        ),
      )
      .subscribe({
        next: ({ variant, rows }) => {
          this.variant.set(variant);
          this.subtitle.set(variant.attributeValues.map((item) => item.value).join(' · ') || null);
          this.identifiers.reset({ sku: variant.sku, barcode: variant.barcode ?? '' });
          this.priceRows.set(rows);
          rows.forEach((row) => this.priceControl(row.list.id).reset());
          this.loadAttributeSelections(variant);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            describeApiError(
              error,
              $localize`:@@variants.detail.loadFailedHint:Try again in a moment.`,
            ),
          );
        },
      });
  }

  priceControl(listId: string): FormControl<number | null> {
    let control = this.priceControls.get(listId);
    if (!control) {
      control = this.formBuilder.control<number | null>(null, [Validators.min(0)]);
      this.priceControls.set(listId, control);
    }
    return control;
  }

  saveIdentifiers(current: Variant): void {
    if (this.identifiers.invalid) {
      this.identifiers.markAllAsTouched();
      return;
    }
    const value = this.identifiers.getRawValue();
    const attributeValueIds = Object.values(this.attributeSelections()?.getRawValue() ?? {})
      .filter((id) => id.length > 0);
    this.busy.set(true);
    this.identifierError.set(null);
    this.api.updateIdentifiers(current.id, value.sku.trim(), blankToNull(value.barcode), attributeValueIds).subscribe({
      next: () => {
        this.busy.set(false);
        this.snackBar.open($localize`:@@variants.identifiersSaved:Identifiers saved.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.identifierError.set(
          describeApiError(
            error,
            $localize`:@@variants.identifiersFailed:We could not save the identifiers.`,
          ),
        );
      },
    });
  }

  generateBarcode(current: Variant): void {
    this.busy.set(true);
    this.api.generateBarcode(current.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.snackBar.open($localize`:@@variants.barcodeGenerated:Barcode generated.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.snackBar.open(
          describeApiError(
            error,
            $localize`:@@variants.barcodeFailed:The barcode could not be generated.`,
          ),
          undefined,
          { duration: 5000 },
        );
      },
    });
  }

  savePrice(row: PriceRow): void {
    const price = numberOrNull(this.priceControl(row.list.id).value);
    if (price === null || price < 0) {
      this.snackBar.open(
        $localize`:@@priceLists.invalid:Enter a price of zero or more.`,
        undefined,
        { duration: 4000 },
      );
      return;
    }
    this.busy.set(true);
    this.api.setPrice(row.list.id, this.variantId, price).subscribe({
      next: () => {
        this.busy.set(false);
        this.priceControl(row.list.id).reset();
        this.snackBar.open($localize`:@@priceLists.saved:Price saved.`, undefined, {
          duration: 3000,
        });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.snackBar.open(
          describeApiError(
            error,
            $localize`:@@priceLists.saveFailed:The price could not be saved.`,
          ),
          undefined,
          { duration: 5000 },
        );
      },
    });
  }

  deactivate(current: Variant): void {
    this.confirm
      .confirm({
        title: $localize`:@@variants.deactivate.title:Deactivate variant?`,
        message: $localize`:@@variants.deactivate.message:A deactivated variant cannot be sold or stocked. Variants cannot be reactivated.`,
        confirmLabel: $localize`:@@common.deactivate:Deactivate`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.api.deactivate(current.id).subscribe({
          next: () => {
            this.snackBar.open($localize`:@@variants.deactivated:Variant deactivated.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              describeApiError(
                error,
                $localize`:@@variants.deactivateFailed:The variant could not be deactivated.`,
              ),
              undefined,
              { duration: 5000 },
            ),
        });
      });
  }

  private loadAttributeSelections(variant: Variant): void {
    forkJoin({
      product: this.productsApi.get(variant.productId),
      attributes: this.attributesApi.list(),
      categories: this.categoriesApi.tree(),
    }).subscribe({
      next: ({ product, attributes, categories }) => {
        const category = findCategory(categories, product.categoryId);
        const configured = attributes.filter((attribute) => category?.attributeIds.includes(attribute.id));
        const selected = new Map(variant.attributeValues.map((value) => [value.attributeId, value.attributeValueId]));
        this.attributes.set(configured);
        this.attributeSelections.set(this.formBuilder.group(Object.fromEntries(configured.map((attribute) => [
          attribute.id,
          this.formBuilder.control(selected.get(attribute.id) ?? ''),
        ]))));
      },
      error: () => this.attributeSelections.set(this.formBuilder.group({})),
    });
  }
}
