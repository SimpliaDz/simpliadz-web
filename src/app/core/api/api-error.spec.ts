import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('maps validation errors from the global handler to camelCase field keys', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        error: 'ValidationError',
        errors: [
          { propertyName: 'NewPassword', errorMessage: 'Password must be 8 to 128 characters.' },
        ],
      },
    });

    const details = toApiError(error);

    expect(details.status).toBe(400);
    expect(details.code).toBe('ValidationError');
    expect(details.fieldErrors).toEqual({ newPassword: 'Password must be 8 to 128 characters.' });
  });

  it('maps problem-style field errors and keeps the first message per key', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { title: 'Bad request', errors: { Name: ['Name is required.', 'Second'] } },
    });

    const details = toApiError(error);

    expect(details.message).toBe('Bad request');
    expect(details.fieldErrors).toEqual({ name: 'Name is required.' });
  });

  it('reads the message of conflict responses', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { message: 'Audit must be enabled for this action.' },
    });

    expect(toApiError(error)).toEqual({
      status: 409,
      code: null,
      message: 'Audit must be enabled for this action.',
      fieldErrors: {},
    });
  });

  it('returns an empty shape for non-HTTP errors and empty bodies', () => {
    expect(toApiError(new Error('boom'))).toEqual({
      status: 0,
      code: null,
      message: null,
      fieldErrors: {},
    });
    expect(toApiError(new HttpErrorResponse({ status: 404, error: '' })).fieldErrors).toEqual({});
  });
});
