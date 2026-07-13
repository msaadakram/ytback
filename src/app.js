import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';
import logger from './utils/logger.js';
import router, { downloadRouter } from './routes/index.js';
import { errorHandler, notFound } from './middlewares/error.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { requestTimeout } from './middlewares/timeout.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  // Use express.text to intercept the raw JSON string and auto-fix shell-escaped URLs
  app.use(express.text({ type: 'application/json', limit: '256kb' }));
  app.use((req, res, next) => {
    if (typeof req.body === 'string') {
      if (!req.body.trim()) {
        req.body = {};
        return next();
      }
      try {
        // Automatically remove \?, \=, \& which zsh pastes into terminal strings
        const cleaned = req.body.replace(/\\([?=&])/g, '$1');
        req.body = JSON.parse(cleaned);
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid JSON body. Check for incorrectly escaped characters.' },
        });
      }
    }
    next();
  });
  app.use(express.urlencoded({ extended: false }));

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || config.allowedOrigins.length === 0 || config.allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(new Error(`Origin ${origin} not allowed`));
      },
    })
  );

  const stream = { write: (msg) => logger.info({ req: msg.trim() }, msg.trim().split(' ')[0]) };
  app.use(
    morgan(config.isProd ? 'combined' : 'dev', {
      stream,
      skip: (req) => req.path === '/api/health',
    })
  );

  app.use(requestTimeout);
  app.use('/api', apiLimiter, router);
  app.use('/download', downloadRouter);

  app.get('/', (_req, res) => {
    res.json({
      success: true, data: {
        name: 'ytback', version: '2.0.0', platforms: [
          'youtube', 'tiktok', 'instagram', 'facebook', 'vimeo', 'twitch', 'dailymotion', 'reddit', 'soundcloud',
          'kick', 'snapchat', 'linkedin', 'pinterest', 'niconico'
        ], docs: '/api/health'
      }
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
