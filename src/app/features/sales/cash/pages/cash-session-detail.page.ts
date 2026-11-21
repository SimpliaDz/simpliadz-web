import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { numberOrNull } from '../../../../shared/forms/form-values';
import { ConfirmService } from '../../../../shared/ui/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/ui/state-panel/state-panel.component';
import { StatusChipComponent } from '../../../../shared/ui/status-chip/status-chip.component';
import {
  CashApiService,
  CashMovement,
  CashRegister,
  CashSession,
} from '../data-access/cash-api.service';

@Component({
  selector: 'app-cash-session-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
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
    } @else if (session(); as current) {
      <app-page-header
        [title]="registerName()"
        [backLink]="backLink"
        [subtitle]="(current.openedAt | date: 'medium') ?? ''"
      >
        <app-status-chip
          [label]="current.status === 'Open' ? openLabel : closedLabel"
          [tone]="current.status === 'Open' ? 'neutral' : 'success'"
        />
      </app-page-header>

      @if (actionError(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      <div class="card-grid">
        <mat-card appearance="outlined">
          <mat-card-header
            ><mat-card-title i18n="@@sessions.summary">Summary</mat-card-title></mat-card-header
          >
          <mat-card-content>
            <dl class="detail-list">
              <dt i18n="@@sessions.openingCash">Opening cash</dt>
              <dd>{{ current.openingCash | number: '1.2-2' }}</dd>
              <dt i18n="@@sessions.cashPayments">Cash payments</dt>
              <dd>{{ current.cashPayments | number: '1.2-2' }}</dd>
              <dt i18n="@@sessions.otherPayments">Other payments</dt>
              <dd>{{ current.otherPayments | number: '1.2-2' }}</dd>
              <dt i18n="@@sessions.movements">Cash movements</dt>
              <dd>{{ current.cashMovements | number: '1.2-2' }}</dd>
              <dt i18n="@@sessions.expected">Expected cash</dt>
              <dd>
                <strong>{{ current.expectedCash | number: '1.2-2' }}</strong>
              </dd>
              @if (current.status === 'Closed') {
                <dt i18n="@@sessions.counted">Counted cash</dt>
                <dd>{{ current.countedCash | number: '1.2-2' }}</dd>
                <dt i18n="@@sessions.difference">Difference</dt>
                <dd>{{ current.difference | number: '1.2-2' }}</dd>
              }
            </dl>
          </mat-card-content>
        </mat-card>
      </div>

      <h2 class="section-title" i18n="@@sessions.movements">Cash movements</h2>
      @if (movements().length === 0) {
        <p class="muted" i18n="@@sessions.noMovements">
          No cash has been added or removed outside sales.
        </p>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="movements()" class="data-table">
            <ng-container matColumnDef="when">
              <th mat-header-cell *matHeaderCellDef i18n="@@movements.when">When</th>
              <td mat-cell *matCellDef="let row">{{ row.occurredAt | date: 'medium' }}</td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef i18n="@@sessions.amount">Amount</th>
              <td mat-cell *matCellDef="let row">{{ row.amountDelta | number: '1.2-2' }}</td>
            </ng-container>
            <ng-container matColumnDef="reason">
              <th mat-header-cell *matHeaderCellDef i18n="@@movements.note">Reason</th>
              <td mat-cell *matCellDef="let row">{{ row.reason }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="movementColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: movementColumns"></tr>
          </table>
        </div>
      }

      @if (canManage() && current.status === 'Open') {
        <h2 class="section-title" i18n="@@sessions.addMovement">Add or remove cash</h2>
        <form
          class="form-surface"
          [formGroup]="movementForm"
          (ngSubmit)="addMovement(current)"
          novalidate
        >
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@sessions.amount">Amount</mat-label>
              <input matInput type="number" step="0.0001" formControlName="amountDelta" />
              <mat-hint i18n="@@sessions.amountHint"
                >Negative to take cash out, for example a bank drop.</mat-hint
              >
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@sessions.reason">Reason</mat-label>
              <input matInput formControlName="reason" maxlength="500" />
              @if (movementForm.controls.reason.hasError('required')) {
                <mat-error i18n="@@validation.required">This field is required.</mat-error>
              }
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button
              mat-stroked-button
              type="submit"
              [disabled]="busy()"
              i18n="@@sessions.addMovement.action"
            >
              Record movement
            </button>
          </div>
        </form>

        <h2 class="section-title" i18n="@@sessions.close">Close the session</h2>
        <form class="form-surface" [formGroup]="closeForm" (ngSubmit)="close(current)" novalidate>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@sessions.countedCash">Counted cash</mat-label>
              <input matInput type="number" min="0" step="0.0001" formControlName="countedCash" />
              <mat-hint i18n="@@sessions.closeHint"
                >Count the drawer. The difference against expected cash is recorded.</mat-hint
              >
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button
              mat-flat-button
              type="submit"
              [disabled]="busy()"
              i18n="@@sessions.close.action"
            >
              Close session
            </button>
          </div>
          <p class="form-hint" i18n="@@sessions.auditNotice">
            Closing a session is recorded in the audit trail.
          </p>
        </form>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashSessionDetailPage {
  private readonly api = inject(CashApiService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session_ = inject(AuthSessionService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly sessionId = this.activatedRoute.snapshot.paramMap.get('id') ?? '';

  readonly errorTitle = $localize`:@@sessions.detail.loadFailed:We could not load this session`;
  readonly openLabel = $localize`:@@sessions.status.open:Open`;
  readonly closedLabel = $localize`:@@sessions.status.closed:Closed`;
  readonly backLink = {
    label: $localize`:@@sessions.backToList:All sessions`,
    path: '/app/sales/cash/sessions',
  };
  readonly movementColumns = ['when', 'amount', 'reason'];

  readonly canManage = computed(() => this.session_.hasPermission('cash-sessions.manage'));
  readonly session = signal<CashSession | null>(null);
  readonly register = signal<CashRegister | null>(null);
  readonly movements = signal<CashMovement[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly movementForm = this.formBuilder.group({
    amountDelta: this.formBuilder.control<number | null>(null, [Validators.required]),
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });
  readonly closeForm = this.formBuilder.group({
    countedCash: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
  });

  constructor() {
    this.load();
  }

  registerName(): string {
    const register = this.register();
    return register
      ? `${register.name} (${register.code})`
      : $localize`:@@sessions.heading:Cash session`;
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      session: this.api.session(this.sessionId),
      movements: this.api.movements(this.sessionId),
    }).subscribe({
      next: ({ session, movements }) => {
        this.session.set(session);
        this.movements.set(movements);
        this.loading.set(false);
        this.api
          .registers(session.locationId)
          .subscribe((registers) =>
            this.register.set(registers.find((item) => item.id === session.cashRegisterId) ?? null),
          );
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          describeApiError(
            error,
            $localize`:@@sessions.detail.loadFailedHint:Try again in a moment.`,
          ),
        );
      },
    });
  }

  addMovement(current: CashSession): void {
    const value = this.movementForm.getRawValue();
    const amount = numberOrNull(value.amountDelta);
    if (amount === null || amount === 0 || !value.reason.trim()) {
      this.movementForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api.addMovement(current.id, amount, value.reason.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.movementForm.reset({ amountDelta: null, reason: '' });
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          describeApiError(
            error,
            $localize`:@@sessions.movementFailed:The movement could not be recorded.`,
          ),
        );
      },
    });
  }

  close(current: CashSession): void {
    const counted = numberOrNull(this.closeForm.getRawValue().countedCash);
    if (counted === null || counted < 0) {
      this.closeForm.markAllAsTouched();
      return;
    }
    this.confirm
      .confirm({
        title: $localize`:@@sessions.close.title:Close this session?`,
        message: $localize`:@@sessions.close.message:After closing, no more sales can be paid in cash on this session.`,
        confirmLabel: $localize`:@@sessions.close.action:Close session`,
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy.set(true);
        this.api.close(current.id, counted).subscribe({
          next: () => {
            this.busy.set(false);
            this.snackBar.open($localize`:@@sessions.closed:Session closed.`, undefined, {
              duration: 3000,
            });
            this.load();
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.actionError.set(
              describeApiError(
                error,
                $localize`:@@sessions.closeFailed:The session could not be closed.`,
              ),
            );
          },
        });
      });
  }
}
