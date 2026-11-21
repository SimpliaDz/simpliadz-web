import { toApiError } from './api-error';

/**
 * Turns any API failure into one sentence for a page or dialog. Field-level messages are
 * appended so a form can show every server-side problem in one place.
 */
export function describeApiError(error: unknown, fallback: string): string {
  const details = toApiError(error);

  switch (details.status) {
    case 0:
      return $localize`:@@error.network:We could not reach the server. Check your connection and try again.`;
    case 401:
      return $localize`:@@error.sessionExpired:Your session has ended. Sign in again to continue.`;
    case 403:
      return $localize`:@@error.forbidden:You do not have permission to do this.`;
    case 404:
      return details.message ?? $localize`:@@error.notFound:The requested item could not be found.`;
  }

  const base = details.message ?? fallback;
  const fieldMessages = Object.values(details.fieldErrors).filter((text) => text !== base);
  return [base, ...fieldMessages].join(' ');
}
