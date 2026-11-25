import { HttpErrorResponse } from '@angular/common/http';

/**
 * Normalizes the two error shapes the Simplia API returns:
 *  - global handler: `{ error, message, errors?: [{ propertyName, errorMessage }] }`
 *  - inline/problem: `{ title, status, errors: { key: [message] } }`
 * Field keys are returned lower-camel-cased so they match Reactive Form control names.
 */
export interface ApiErrorDetails {
  readonly status: number;
  readonly code: string | null;
  readonly message: string | null;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

export function toApiError(error: unknown): ApiErrorDetails {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, code: null, message: null, fieldErrors: {} };
  }

  const body: unknown = error.error;

  if (!isRecord(body)) {
    return { status: error.status, code: null, message: null, fieldErrors: {} };
  }

  return {
    status: error.status,
    code: typeof body['error'] === 'string' ? body['error'] : null,
    message: firstString(body['message'], body['title']),
    fieldErrors: readFieldErrors(body['errors']),
  };
}

function readFieldErrors(errors: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (isRecord(item) && typeof item['propertyName'] === 'string') {
        const message = firstString(item['errorMessage']);
        if (message) {
          result[toCamelKey(item['propertyName'])] ??= message;
        }
      }
    }
    return result;
  }

  if (isRecord(errors)) {
    for (const [key, value] of Object.entries(errors)) {
      const message = Array.isArray(value) ? firstString(value[0]) : firstString(value);
      if (message) {
        result[toCamelKey(key)] ??= message;
      }
    }
  }

  return result;
}

function toCamelKey(key: string): string {
  return key.charAt(0).toLowerCase() + key.slice(1);
}

function firstString(...values: unknown[]): string | null {
  return (
    values.find((value): value is string => typeof value === 'string' && value.length > 0) ?? null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
