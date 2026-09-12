import { describe, expect, it } from 'vitest';
import { createAppError, isAppError } from '@/shared/errors.js';

describe('functional application errors', () => {
  it('creates a structured error without absent details', () => {
    const error = createAppError(404, 'USER_NOT_FOUND', 'User not found');
    expect(error).toMatchObject({
      type: 'AppError',
      status: 404,
      code: 'USER_NOT_FOUND',
      message: 'User not found',
    });
    expect(isAppError(error)).toBe(true);
    expect(error).not.toHaveProperty('details');
  });
  it('preserves supplied details', () => {
    expect(createAppError(400, 'INVALID', 'Invalid', null).details).toBeNull();
  });
  it.each([
    null,
    undefined,
    'error',
    42,
    new Error('native'),
    {},
    { type: 'AppError' },
    { type: 'AppError', status: '404', code: 'BAD', message: 'Bad' },
  ])('rejects malformed errors: %j', (value) => {
    expect(isAppError(value)).toBe(false);
  });
});
