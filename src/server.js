import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { ensureDirs } from './config/dirs.js';
import { ensureCookiesFile } from './config/cookies.js';
import logger from './utils/logger.js';
import { startCleanupJob, runCleanup } from './jobs/cleanup.js';
import { downloadQueue } from './queue/index.js';

ensureDirs();
ensureCookiesFile();

const app = createApp();
const server = http.createServer(app);

let cleanupTimer;

server.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env, concurrency: config.maxConcurrentDownloads },
    'ytback server listening'
  );
  cleanupTimer = startCleanupJob();
  runCleanup().catch((err) => logger.error({ err: err.message }, 'initial cleanup failed'));
});

function shutdown(signal) {
  logger.info({ signal }, 'shutdown received, draining...');
  server.close((err) => {
    if (err) logger.error({ err: err.message }, 'server close error');
    downloadQueue.pause();
    if (cleanupTimer) clearInterval(cleanupTimer);
    logger.info('shutdown complete');
    process.exit(0);
  });
  // Force exit if connections hang
  setTimeout(() => {
    logger.warn('forcing exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: reason?.stack || reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err: err.stack }, 'uncaughtException');
  shutdown('uncaughtException');
});

export default server;
