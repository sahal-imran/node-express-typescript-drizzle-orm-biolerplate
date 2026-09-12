export type AppError = {
  readonly type: 'AppError';
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
};

export function createAppError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): AppError & Error {
  return Object.assign(Error(message), {
    name: 'AppError',
    type: 'AppError' as const,
    status,
    code,
    ...(details === undefined ? {} : { details }),
  });
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'AppError' &&
    'status' in error &&
    typeof error.status === 'number' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}
