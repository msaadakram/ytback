import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { jobStore, JobStatus } from '../core/jobStore.js';

async function safeUnlink(p) {
  try {
    await fsp.unlink(p);
    return true;
  } catch {
    return false;
  }
}

async function cleanDir(dir, olderThanMs) {
  const now = Date.now();
  let removed = 0;
  let files = [];
  try {
    files = await fsp.readdir(dir);
  } catch {
    return removed;
  }
  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const st = await fsp.stat(full);
      if (st.isFile() && now - st.mtimeMs > olderThanMs) {
        await safeUnlink(full);
        removed++;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

export async function runCleanup() {
  const now = Date.now();
  const ttl = config.autoDeleteMinutes * 60 * 1000;

  // Expire jobs and remove their files
  const expired = jobStore.collectExpired();
  for (const job of expired) {
    if (job.filepath) await safeUnlink(job.filepath);
    logger.info({ jobId: job.id }, 'job expired, file removed');
  }
  // Remove expired jobs from memory after their files are deleted
  for (const job of expired) {
    if (job.status === JobStatus.EXPIRED) jobStore.remove(job.id);
  }

  // Failed jobs: drop from memory, leave temp files to be swept
  for (const job of jobStore.list()) {
    if (job.status === JobStatus.FAILED && job.completedAt && now - job.completedAt > ttl) {
      jobStore.remove(job.id);
    }
  }

  const tempRemoved = await cleanDir(config.tempDir, ttl);
  const dlRemoved = await cleanDir(config.downloadDir, ttl * 2);

  if (expired.length || tempRemoved || dlRemoved) {
    logger.info(
      { expired: expired.length, tempRemoved, dlRemoved },
      'cleanup run'
    );
  }
}

export function startCleanupJob() {
  const id = setInterval(runCleanup, config.cleanupIntervalMs);
  id.unref?.();
  logger.info(
    { intervalMs: config.cleanupIntervalMs, ttlMin: config.autoDeleteMinutes },
    'cleanup job scheduled'
  );
  return id;
}
