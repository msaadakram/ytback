import PQueue from 'p-queue';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

export const downloadQueue = new PQueue({
  concurrency: config.maxConcurrentDownloads,
  timeout: config.maxDownloadTime * 1000,
  throwOnTimeout: false,
});

downloadQueue.on('error', (err) => {
  logger.error({ err: err.message }, 'queue error');
});

downloadQueue.on('idle', () => {
  logger.debug('download queue idle');
});

export default downloadQueue;
