import { HttpErrorResponse } from '@angular/common/http';
import { describeApiError } from './api-error-message';

describe('describeApiError', () => {
  it('uses the server message for conflicts', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { message: 'Audit must be enabled for this action.' },
    });

    expect(describeApiError(error, 'fallback')).toBe('Audit must be enabled for this action.');
  });

  it('uses the fallback when the server gives no message', () => {
    const error = new HttpErrorResponse({ status: 500, error: null });

    expect(describeApiError(error, 'Could not save.')).toBe('Could not save.');
  });

  it('explains authorization failures without exposing server text', () => {
    const error = new HttpErrorResponse({ status: 403, error: '' });

    expect(describeApiError(error, 'fallback')).toBe('You do not have permission to do this.');
  });

  it('asks the user to sign in again on 401', () => {
    const error = new HttpErrorResponse({ status: 401, error: '' });

    expect(describeApiError(error, 'fallback')).toBe(
      'Your session has ended. Sign in again to continue.',
    );
  });

  it('appends field-level messages once each', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        error: 'ValidationError',
        message: 'Check the highlighted fields.',
        errors: [
          { propertyName: 'Name', errorMessage: 'Name is required.' },
          { propertyName: 'Code', errorMessage: 'Code is too long.' },
        ],
      },
    });

    expect(describeApiError(error, 'fallback')).toBe(
      'Check the highlighted fields. Name is required. Code is too long.',
    );
  });
});
