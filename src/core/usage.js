import { getDb, ObjectId } from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Best-effort usage event log. Never throws — usage logging must not break a download.
 * Only records when a user is present (req.user) to keep anonymous traffic from flooding the store.
 *
 * @param {object|null} user  - req.user (from optionalAuth/requireUser) or null
 * @param {string} kind       - 'info' | 'download' | 'audio' | 'transcribe' | 'other'
 * @param {object} opts       - { platform, status }
 */
export async function logUsage(user, kind, { platform = null, status = 'success' } = {}) {
  if (!user) return;
  try {
    const db = getDb();
    await db.collection('usage_events').insertOne({
      user_id: new ObjectId(user.id),
      kind,
      platform,
      status,
      created_at: new Date(),
    });
  } catch (err) {
    logger.debug({ err: err.message, kind }, 'usage log failed (ignored)');
  }
}

/**
 * Record a completed/failed download to the user's history.
 * Only when a user is present (anonymous downloads are not recorded).
 * Never throws — wraps in try/catch; history must not break a download.
 *
 * @param {object} job - the job object (has userId, platform, type, title, filename, etc.)
 * @param {string} status - 'completed' | 'failed'
 */
export async function recordDownload(job, status) {
  if (!job.userId) return;
  try {
    const db = getDb();
    const formatLabel = job.formatId
      ? `ID ${job.formatId}`
      : (job.quality ? `${job.quality.toUpperCase()}${job.container ? ` • ${job.container}` : ''}` : (job.format ? job.format.toUpperCase() : null));
    await db.collection('downloads').insertOne({
      user_id: new ObjectId(job.userId),
      job_id: job.id,
      platform: job.platform || 'generic',
      type: job.type || 'video',
      title: job.title || null,
      filename: job.filename || null,
      source_url: job.url || null,
      size: job.size || 0,
      format_label: formatLabel,
      status,
      error: status === 'failed' ? (job.error || null) : null,
      created_at: new Date(job.createdAt || Date.now()),
      completed_at: new Date(job.completedAt || Date.now()),
    });
  } catch (err) {
    logger.debug({ err: err.message, jobId: job.id }, 'download history write failed (ignored)');
  }
}
