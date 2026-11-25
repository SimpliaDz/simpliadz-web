import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { finalize, Observable } from 'rxjs';
import { describeApiError } from '../../../core/api/api-error-message';
import { Customer } from '../../sales/customers/data-access/customers-api.service';
import { LoyaltyApiService, LoyaltyCard } from '../data-access/loyalty-api.service';

@Component({
  selector: 'app-digital-card-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Digital loyalty card</h2>
    <mat-dialog-content>
      @if (preview(); as url) {
        <img class="card-preview" [src]="url" [alt]="'Loyalty card for ' + customer.name" />
      } @else {
        <div class="card"><small>CARTE FIDÉLITÉ</small><strong>{{ customer.name }}</strong>
          <div class="barcode">{{ card()?.cardNumber ?? 'Barcode added when generated' }}</div>
        </div>
      }
      @if (!customer.email) { <p>Add an email address to send this card.</p> }
      @if (card() && !card()?.isActive) { <p>This card is inactive.</p> }
      @if (error(); as message) { <p role="alert">{{ message }}</p> }
      @if (sent()) { <p role="status">Card sent to {{ customer.email }}.</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      @if (card(); as issued) {
        <button mat-button [disabled]="busy()" (click)="download()">Download PDF</button>
        <button mat-flat-button [disabled]="busy() || !customer.email || !issued.isActive || !customer.isActive"
          (click)="send()">Send by email</button>
      } @else {
        <button mat-flat-button [disabled]="busy() || !missing() || !customer.isActive" (click)="generate()">Generate card</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .card-preview { display:block; width:100%; height:auto; }
    .card { background:#203c34; color:white; border-radius:1rem; padding:1.25rem; display:grid; gap:.65rem; }
    small { color:#dfc88f; letter-spacing:.12em; font-weight:700; }
    strong { overflow-wrap:anywhere; font-size:1.2rem; }
    .barcode { background:white; color:#101d33; padding:1rem; border-radius:.35rem; text-align:center; }
  `,
})
export class DigitalCardDialogComponent {
  readonly customer = inject<Customer>(MAT_DIALOG_DATA);
  private readonly api = inject(LoyaltyApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly preview = signal<string | null>(null);
  readonly card = signal<LoyaltyCard | null>(null);
  readonly missing = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => {
      const url = this.preview();
      if (url) URL.revokeObjectURL(url);
    });
    this.run(this.api.cardForCustomer(this.customer.id), card => this.showCard(card), 'Could not load the loyalty card.', true);
  }
  generate(): void {
    this.run(this.api.enroll(this.customer.id), card => this.showCard(card), 'Could not generate the card.');
  }
  private showCard(card: LoyaltyCard): void {
    this.card.set(card);
    this.api.previewCard(this.customer.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => this.preview.set(URL.createObjectURL(blob)),
      error: () => {},
    });
  }
  download(): void {
    this.run(this.api.downloadCard(this.customer.id), pdf => {
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'carte-fidelite.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'Could not download the card.');
  }
  send(): void {
    this.sent.set(false);
    this.run(this.api.emailCard(this.customer.id), () => this.sent.set(true), 'Could not send the card.');
  }
  private run<T>(request: Observable<T>, success: (value: T) => void, fallback: string, allowMissing = false): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: success,
      error: (error: unknown) => {
        if (allowMissing && error instanceof HttpErrorResponse && error.status === 404) this.missing.set(true);
        else if (error instanceof HttpErrorResponse && error.status === 404 && error.error instanceof Blob)
          this.error.set('Card download is unavailable. Check that the API is running the latest version.');
        else this.error.set(describeApiError(error, fallback));
      },
    });
  }
}
