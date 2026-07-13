export class HttpError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  BadRequest: (msg = 'Bad request', details) =>
    new HttpError(400, 'BAD_REQUEST', msg, details),
  ValidationError: (msg = 'Validation failed', details) =>
    new HttpError(422, 'VALIDATION_ERROR', msg, details),
  NotFound: (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg),
  JobNotFound: (msg = 'Job not found') => new HttpError(404, 'JOB_NOT_FOUND', msg),
  Conflict: (msg = 'Conflict') => new HttpError(409, 'CONFLICT', msg),
  TooMany: (msg = 'Too many requests') => new HttpError(429, 'RATE_LIMIT', msg),
  DownloadFailed: (msg = 'Download failed', details) =>
    new HttpError(502, 'DOWNLOAD_FAILED', msg, details),
  Internal: (msg = 'Internal server error', details) =>
    new HttpError(500, 'INTERNAL', msg, details),
};

export default HttpError;
