import { config } from '../config/index.js';
import { HttpError } from '../utils/HttpError.js';

export function requestTimeout(req, res, next) {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' },
      });
    }
    req.destroy();
  }, config.requestTimeoutMs);

  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
}
