import logger from '../utils/logger.js';
import { Errors, HttpError } from '../utils/HttpError.js';
import { config } from '../config/index.js';

// eslint-disable-next-line no-unused-vars
export function notFound(req, _res, next) {
  next(Errors.NotFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isHttp = err instanceof HttpError;
  let statusCode = isHttp ? err.statusCode : 500;
  let code = isHttp ? err.code : 'INTERNAL';

  // Catch remaining body-parser or payload errors gracefully
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    err.message = 'Invalid JSON or payload entity.';
  }

  if (statusCode >= 500) {
    logger.error({ err: err.message, stack: err.stack, path: req.path }, 'request error');
  } else if (statusCode >= 400) {
    logger.warn({ code, msg: err.message, path: req.path }, 'client error');
  }

  const body = {
    success: false,
    error: {
      code,
      message: err.message || 'Internal server error',
    },
  };
  if (err.details) body.error.details = err.details;
  if (!config.isProd && err.stack && statusCode >= 500) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

export function wrapAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
