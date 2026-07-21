import { fetchInfo } from '../../core/ytdlp.js';
import { downloadVideo, downloadAudio } from '../../core/download.js';
import { jobStore, JobStatus } from '../../core/jobStore.js';
import { downloadQueue } from '../../queue/index.js';
import { detectPlatform } from '../../utils/platformDetector.js';
import { formatBytes, formatDuration } from '../../utils/format.js';
import { Errors } from '../../utils/HttpError.js';
import { wrapAsync } from '../../middlewares/error.js';
import { logUsage } from '../../core/usage.js';

const AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'aac', 'opus', 'flac'];

function mapFormat(f) {
  return {
    format_id: f.format_id,
    ext: f.ext,
    resolution: f.resolution,
    width: f.width,
    height: f.height,
    fps: f.fps,
    vcodec: f.vcodec,
    acodec: f.acodec,
    tbr: f.tbr,
    abr: f.abr,
    vbr: f.vbr,
    filesize: f.filesize ?? f.filesize_approx ?? null,
    filesize_str: formatBytes(f.filesize ?? f.filesize_approx ?? 0),
    quality_label: f.format_note || null,
    protocol: f.protocol,
  };
}

/**
 * GET /api/info
 * Accept any URL, auto-detect platform, and return metadata + organised format lists.
 */
export const getUniversalInfo = wrapAsync(async (req, res) => {
  const { url } = req.validated;

  const detected = detectPlatform(url);
  const platform = detected ? detected.platform : 'generic';

  const info = await fetchInfo(url, platform);
  const formats = Array.isArray(info.formats) ? info.formats : [];

  const isVideo = (f) => f.vcodec && f.vcodec !== 'none';
  const isAudio = (f) => f.acodec && f.acodec !== 'none';
  const isAudioOnly = (f) => (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none';
  const isVideoWithAudio = (f) => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none';

  const data = {
    id: info.id,
    platform,
    detected_hostname: detected?.hostname || null,
    title: info.title || 'Untitled',
    url: info.original_url || info.webpage_url || url,
    duration: info.duration || 0,
    duration_str: formatDuration(info.duration),
    thumbnail: info.thumbnail || null,
    uploader: info.uploader || info.channel || null,
    channel: info.channel || null,
    upload_date: info.upload_date || null,
    description: info.description || null,
    view_count: info.view_count || 0,
    like_count: info.like_count || 0,
    extractor: info.extractor_key || null,
    webpage_url: info.webpage_url || null,
    extractor_key: info.extractor_key || null,
    categories: info.categories || [],
    tags: info.tags || [],
    chapters: info.chapters || [],
    playlist: info.playlist || null,
    subtitles: Object.keys(info.subtitles || {}),
    automatic_captions: Object.keys(info.automatic_captions || {}),

    /* Organised format lists for the frontend */
    video_formats: formats.filter(isVideo).map(mapFormat),
    audio_formats: formats.filter(isAudio).map(mapFormat),
    audio_only_formats: formats.filter(isAudioOnly).map(mapFormat),
    video_with_audio_formats: formats.filter(isVideoWithAudio).map(mapFormat),

    /* Summary / best guess */
    best_format: info.format_id ? mapFormat(info) : null,
    filesize: info.filesize ?? info.filesize_approx ?? null,
    filesize_str: formatBytes(info.filesize ?? info.filesize_approx ?? 0),

    /* Audio-specific for extraction */
    audio_ext: AUDIO_EXTS,
  };

  res.json({ success: true, data });
  logUsage(req.user, 'info', { platform });
});

/**
 * POST /api/download
 * Accept any URL, auto-detect platform, enqueue a video download.
 */
export const downloadUniversalVideo = wrapAsync(async (req, res) => {
  const { url, format_id, quality, container } = req.validated;

  const detected = detectPlatform(url);
  const platform = detected ? detected.platform : 'generic';

  let title;
  try {
    const info = await fetchInfo(url, platform);
    title = info.title;
  } catch {
    title = 'video';
  }

  const job = jobStore.create({
    type: 'video',
    platform,
    url,
    formatId: format_id,
    quality,
    container: container || 'mp4',
    title,
    userId: req.user?.id || null,
  });

  downloadQueue.add(() => downloadVideo(job)).catch((err) => {
    jobStore.update(job.id, {
      status: JobStatus.FAILED,
      error: err.message || String(err),
      completedAt: Date.now(),
    });
  });

  res.status(202).json({
    success: true,
    data: {
      job_id: job.id,
      platform,
      type: 'video',
      status: 'started',
    },
  });
  logUsage(req.user, 'download', { platform });
});

/**
 * POST /api/audio
 * Accept any URL, auto-detect platform, enqueue an audio download.
 */
export const downloadUniversalAudio = wrapAsync(async (req, res) => {
  const { url, format, quality } = req.validated;

  const detected = detectPlatform(url);
  const platform = detected ? detected.platform : 'generic';

  let title;
  try {
    const info = await fetchInfo(url, platform);
    title = info.title;
  } catch {
    title = 'audio';
  }

  const job = jobStore.create({
    type: 'audio',
    platform,
    url,
    format: format || 'mp3',
    quality: String(quality || '320'),
    title,
    userId: req.user?.id || null,
  });

  downloadQueue.add(() => downloadAudio(job)).catch((err) => {
    jobStore.update(job.id, {
      status: JobStatus.FAILED,
      error: err.message || String(err),
      completedAt: Date.now(),
    });
  });

  res.status(202).json({
    success: true,
    data: {
      job_id: job.id,
      platform,
      type: 'audio',
      status: 'started',
    },
  });
  logUsage(req.user, 'audio', { platform });
});
