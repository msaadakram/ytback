import { jobStore } from '../core/jobStore.js';
import { JobStatus } from '../core/jobStore.js';
import { wrapAsync } from '../middlewares/error.js';
import { Errors } from '../utils/HttpError.js';

export const getJobStatus = wrapAsync(async (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job) throw Errors.JobNotFound();
  res.json({
    success: true,
    data: {
      jobId: job.id,
      type: job.type,
      platform: job.platform || null,
      status: job.status,
      progress: job.progress,
      speed: job.speed,
      eta: job.eta,
      downloaded: job.downloaded,
      total: job.total,
      transcript: job.transcript,
      segments: job.segments,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    },
  });
});

export const getJobResult = wrapAsync(async (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job) throw Errors.JobNotFound();
  res.json({
    success: true,
    data: {
      jobId: job.id,
      platform: job.platform || null,
      status: job.status,
      filename: job.filename,
      size: job.size,
      downloadUrl: job.downloadUrl,
      transcript: job.transcript,
      segments: job.segments,
      jsonFilename: job.jsonFilename,
      jsonDownloadUrl: job.jsonDownloadUrl,
      jsonSize: job.jsonSize,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      expiresAt: job.expiresAt,
    },
  });
});
