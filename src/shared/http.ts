import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { createAppError, isAppError } from './errors.js';
import { logger } from './logger.js';
export const requestId: RequestHandler = (req, res, next) => {
  const id = req.header('x-request-id')?.slice(0, 128) || randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(createAppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} was not found`));
}
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let status = 500,
    code = 'INTERNAL_ERROR',
    message = 'An unexpected error occurred';
  let details: unknown;
  if (isAppError(error)) ({ status, code, message, details } = error);
  else if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request contains invalid data';
    details = error.issues;
  } else logger.error({ err: error, requestId: res.locals.requestId }, 'Unhandled request error');
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      requestId: res.locals.requestId,
    },
  });
}
