import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { finalize, Subscription } from 'rxjs';
import { describeApiError } from '../../../../core/api/api-error-message';
import { ApiUrlService } from '../../../../core/api/api-url.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

type Target = 'Category' | 'Brand' | 'Product' | 'Variant';
interface Promotion {
  id: string;
  name: string;
  target: Target;
  targetId: string;
  discountType: 'Percentage' | 'FixedAmount';
  value: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}
type PromotionDraft = Omit<Promotion, 'id' | 'value'> & { id: string | null; value: number | null };
interface TargetOption { id: string; label: string }

@Component({
  imports: [DatePipe, FormsModule, MatButtonModule, PageHeaderComponent],
  template: `
    <app-page-header title="Promotions" subtitle="Schedule offers for retail sales. The best applicable item discount wins." />
    <form (ngSubmit)="save()" #form="ngForm" class="fields">
      <label>Name <input name="name" required maxlength="120" [(ngModel)]="draft.name" /></label>
      <label>Target type
        <select name="target" [(ngModel)]="draft.target" (ngModelChange)="changeTarget()">
          @for (target of targets; track target) { <option [value]="target">{{ target }}</option> }
        </select>
      </label>
      <label>Find target <input name="search" [(ngModel)]="query" (ngModelChange)="searchTargets()" maxlength="150" /></label>
      <label>Target
        <select name="targetId" required [(ngModel)]="draft.targetId">
          <option value="">Select a target</option>
          @if (draft.targetId && !options().some(hasSelectedTarget)) {
            <option [value]="draft.targetId">Current selection · {{ draft.targetId.slice(0, 8) }}</option>
          }
          @for (option of options(); track option.id) { <option [value]="option.id">{{ option.label }}</option> }
        </select>
      </label>
      <label>Discount type
        <select name="discountType" [(ngModel)]="draft.discountType">
          <option value="Percentage">Percentage</option>
          <option value="FixedAmount">Fixed amount per unit</option>
        </select>
      </label>
      <label>Discount value <input name="value" type="number" min="0.0001" step="0.0001"
        [max]="draft.discountType === 'Percentage' ? 100 : 99999999999999" required [(ngModel)]="draft.value" /></label>
      <label>Starts <input name="startsAt" type="datetime-local" required [(ngModel)]="draft.startsAt" /></label>
      <label>Ends (optional) <input name="endsAt" type="datetime-local" [(ngModel)]="draft.endsAt" /></label>
      <label class="checkbox"><input name="active" type="checkbox" [(ngModel)]="draft.isActive" /> Enabled</label>
      <div class="actions">
        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">Save promotion</button>
        <button mat-button type="button" (click)="reset()" [disabled]="busy()">New promotion</button>
      </div>
    </form>
    @if (error(); as message) { <p role="alert">{{ message }}</p> }
    <ul class="offers">
      @for (offer of promotions(); track offer.id) {
        <li>
          <div><strong>{{ offer.name }}</strong>
            <div>{{ offer.target }} · {{ offer.value }}{{ offer.discountType === 'Percentage' ? '%' : ' per unit' }} · {{ status(offer) }}</div>
            <small>{{ offer.startsAt | date:'medium' }} – {{ offer.endsAt ? (offer.endsAt | date:'medium') : 'Open-ended' }}</small>
          </div>
          <div class="actions">
            <button mat-button type="button" [disabled]="busy()" (click)="edit(offer)">Edit</button>
            <button mat-button type="button" [disabled]="busy()" (click)="update(offer, { isActive: !offer.isActive })">
              {{ offer.isActive ? 'Deactivate' : 'Activate' }}
            </button>
            @if (status(offer) === 'Active') {
              <button mat-button type="button" [disabled]="busy()" (click)="end(offer)">End now</button>
            }
          </div>
        </li>
      } @empty { <li>No promotions configured.</li> }
    </ul>
  `,
  styles: `
    .fields { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr)); }
    label { display:grid; gap:.35rem; }
    input, select { min-width:0; padding:.6rem; font:inherit; color:inherit; background:var(--mat-sys-surface); border:1px solid var(--mat-sys-outline); border-radius:.35rem; }
    .checkbox,.actions { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .offers { padding:0; margin-block:1.5rem; list-style:none; }
    li { padding:1rem 0; border-block-end:1px solid var(--mat-sys-outline-variant); display:flex; gap:1rem; justify-content:space-between; flex-wrap:wrap; }
  `,
})
export class PromotionsPage {
  private readonly http = inject(HttpClient);
  private readonly url = inject(ApiUrlService).path('/sales/promotions');
  private readonly destroyRef = inject(DestroyRef);
  private targetRequest?: Subscription;
  readonly targets: Target[] = ['Category', 'Brand', 'Product', 'Variant'];
  readonly promotions = signal<Promotion[]>([]);
  readonly options = signal<TargetOption[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  draft: PromotionDraft = this.emptyDraft();
  query = '';
  readonly hasSelectedTarget = (option: TargetOption) => option.id === this.draft.targetId;

  constructor() {
    this.load();
    this.searchTargets();
  }

  status(offer: Promotion): string {
    if (!offer.isActive) return 'Disabled';
    const now = Date.now();
    if (new Date(offer.startsAt).getTime() > now) return 'Upcoming';
    return offer.endsAt && new Date(offer.endsAt).getTime() <= now ? 'Ended' : 'Active';
  }

  changeTarget(): void {
    this.draft.targetId = '';
    this.query = '';
    this.searchTargets();
  }

  searchTargets(): void {
    this.targetRequest?.unsubscribe();
    this.options.set([]);
    const params = new HttpParams().set('target', this.draft.target).set('search', this.query);
    this.targetRequest = this.http.get<TargetOption[]>(`${this.url}/targets`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: options => this.options.set(options),
        error: error => this.error.set(describeApiError(error, 'Could not load targets.')),
      });
  }

  reset(): void {
    this.draft = this.emptyDraft();
    this.changeTarget();
  }

  edit(offer: Promotion): void {
    this.draft = { ...offer, startsAt: this.localDate(offer.startsAt),
      endsAt: offer.endsAt ? this.localDate(offer.endsAt) : null };
    this.query = '';
    this.searchTargets();
  }

  save(): void {
    const { id, ...draft } = this.draft;
    const startsAt = new Date(draft.startsAt);
    const endsAt = draft.endsAt ? new Date(draft.endsAt) : null;
    if (!draft.targetId || draft.value === null || !Number.isFinite(startsAt.getTime()) ||
        (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))) {
      this.error.set('Choose a target, enter a discount, and select valid start and end times.');
      return;
    }
    this.store(id, { ...draft, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null });
  }

  update(offer: Promotion, change: Partial<Promotion>): void { this.store(offer.id, { ...offer, ...change }); }
  end(offer: Promotion): void { this.update(offer, { endsAt: new Date().toISOString() }); }

  private load(): void {
    this.http.get<Promotion[]>(this.url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: offers => this.promotions.set(offers),
      error: error => this.error.set(describeApiError(error, 'Could not load promotions.')),
    });
  }

  private store(id: string | null, request: Omit<PromotionDraft, 'id'>): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    (id ? this.http.put(`${this.url}/${id}`, request) : this.http.post(this.url, request))
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
        next: () => { this.reset(); this.load(); },
        error: error => this.error.set(describeApiError(error, 'Could not save the promotion.')),
      });
  }

  private emptyDraft(): PromotionDraft {
    return { id: null, name: '', target: 'Product', targetId: '', discountType: 'Percentage',
      value: null, startsAt: this.localDate(new Date().toISOString()), endsAt: null, isActive: true };
  }

  private localDate(value: string): string {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
}
