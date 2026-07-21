import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { Errors } from '../utils/HttpError.js';
import { sanitizeFilename, formatBytes } from '../utils/format.js';
import { runDownload } from './ytdlp.js';
import { JobStatus, jobStore } from './jobStore.js';
import { recordDownload } from './usage.js';

const AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'aac', 'opus', 'flac'];
const AUDIO_BITRATES = {
    mp3: { 320: '320K', 256: '256K', 192: '192K', 128: '128K' },
    m4a: { 320: '256K', 256: '256K', 192: '192K', 128: '128K' },
    aac: { 320: '256K', 256: '256K', 192: '192K', 128: '128K' },
};

export const VIDEO_QUALITIES = Object.freeze({
    '144p': 144,
    '240p': 240,
    '360p': 360,
    '480p': 480,
    '720p': 720,
    '1080p': 1080,
    '1440p': 1440,
    '2160p': 2160,
    '4k': 2160,
    '4320p': 4320,
    '8k': 4320,
});

export const VIDEO_CONTAINERS = ['mp4', 'mkv', 'webm'];

export function supportedVideoQualities() {
    return [...Object.keys(VIDEO_QUALITIES), 'best', 'worst'];
}

/**
 * Build a yt-dlp format selector for a quality label.
 * Prefers a video+audio merge capped at the requested height, falling back
 * to a single best file at that height.
 */
function buildVideoFormat(quality) {
    if (!quality || quality === 'best') return 'bestvideo*+bestaudio/best';
    if (quality === 'worst') return 'worstvideo*+worstaudio/worst';
    const h = VIDEO_QUALITIES[quality];
    if (!h) return 'bestvideo*+bestaudio/best';
    return `bestvideo*[height<=${h}]+bestaudio/best[height<=${h}]`;
}

export function supportedAudioFormats() {
    return [...AUDIO_EXTS];
}

/**
 * Resolve the directory ffmpeg/ffprobe live in. If the configured binary is a
 * bare name (e.g. "ffmpeg" resolved via PATH), there is no directory to pass
 * and we must NOT use --ffmpeg-location (yt-dlp would then look only inside
 * "."). If it is an absolute path, pass its containing directory.
 */
function maybeFfmpegLocation(args) {
    const bin = config.ffmpegBin;
    if (!bin) return;
    let dir;
    if (path.isAbsolute(bin)) {
        dir = path.dirname(bin);
    } else {
        // Resolve via PATH; if found, pass its directory; otherwise skip.
        try {
            const which = execFileSync('which', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            dir = which ? path.dirname(which) : null;
        } catch {
            dir = null;
        }
    }
    if (dir) {
        args.unshift('--ffmpeg-location', dir);
    }
}

function outTemplate(jobId, ext) {
    const safeId = sanitizeFilename(jobId).slice(0, 40);
    return path.join(config.tempDir, `${safeId}_${Date.now()}.%(ext)s`);
}

/**
 * Download a video. If `formatId` is given (e.g. "137+140"), use it directly;
 * otherwise resolve by `quality` label (360p..4k) via buildVideoFormat.
 */
export async function downloadVideo(job) {
    const { url, formatId, quality, container } = job;
    const outTpl = outTemplate(job.id, container || 'mp4');
    const format =
        formatId && formatId.trim()
            ? formatId.trim()
            : buildVideoFormat(quality);

    const args = [
        '--no-warnings',
        '--no-playlist',
        '--newline',
        '--no-mtime',
        '-o', outTpl,
        '-f', format,
        '--merge-output-format', container || 'mp4',
        url,
    ];
    maybeFfmpegLocation(args);

    return runDownloadTask(job, args, { type: 'video' });
}

/**
 * Download + convert audio to the requested format/quality.
 */
export async function downloadAudio(job) {
    const { url, format, quality } = job;
    const fmt = (format || 'mp3').toLowerCase();
    if (!AUDIO_EXTS.includes(fmt)) throw Errors.ValidationError(`Unsupported audio format: ${fmt}`);

    const outTpl = outTemplate(job.id, fmt);
    const args = [
        '--no-warnings',
        '--no-playlist',
        '--newline',
        '--no-mtime',
        '-o', outTpl,
        '-x', // extract audio
        '--audio-format', fmt,
        '--audio-quality', '0',
        url,
    ];
    maybeFfmpegLocation(args);

    // Use postprocessor args to set bitrate for lossy formats
    const q = parseInt(quality || '320', 10);
    if (['mp3', 'm4a', 'aac'].includes(fmt)) {
        const br = AUDIO_BITRATES[fmt]?.[q] || `${q}K`;
        args.push('--postprocessor-args', `ffmpeg:-b:a ${br}`);
    } else if (fmt === 'opus') {
        args.push('--postprocessor-args', `ffmpeg:-b:a ${Math.min(q, 256)}K`);
    }

    return runDownloadTask(job, args, { type: 'audio' });
}

async function runDownloadTask(job, args, { type }) {
    jobStore.update(job.id, { status: JobStatus.DOWNLOADING, startedAt: Date.now() });
    logger.info({ jobId: job.id, type }, 'download started');

    let lastFilename = null;

    try {
        const res = await runDownload(args, job.platform, {
            onProgress: (p) => {
                jobStore.update(job.id, {
                    status: JobStatus.DOWNLOADING,
                    progress: p.progress,
                    speed: p.speed,
                    eta: p.eta,
                    downloaded: p.downloaded,
                    total: p.total,
                });
            },
            onFilename: (fn) => {
                lastFilename = fn;
            },
        });

        const target = resolveOutputFile(lastFilename || res.filename, job);
        if (!target || !fs.existsSync(target)) {
            throw Errors.DownloadFailed('Output file not found after download');
        }

        // Enforce max file size
        const stat = await fsp.stat(target);
        if (stat.size > config.maxFileSize) {
            await safeUnlink(target);
            throw Errors.DownloadFailed(`File exceeds max size ${formatBytes(config.maxFileSize)}`);
        }

        // Move from temp -> downloads with a safe name
        const ext = path.extname(target).slice(1) || (type === 'audio' ? 'mp3' : (job.container || 'mp4'));
        const finalName = `${sanitizeFilename(job.title || 'media').slice(0, 80) || 'media'}_${job.id.slice(0, 8)}.${ext}`;
        const finalPath = path.join(config.downloadDir, finalName);
        await fsp.rename(target, finalPath);

        const finalStat = await fsp.stat(finalPath);
        const downloadUrl = `/download/${finalName}`;

        jobStore.update(job.id, {
            status: JobStatus.COMPLETED,
            progress: 100,
            filename: finalName,
            filepath: finalPath,
            size: finalStat.size,
            downloadUrl,
            completedAt: Date.now(),
        });

        // Persist to the user's download history (no-op for anonymous jobs).
        recordDownload(jobStore.get(job.id), 'completed').catch(() => {});

        logger.info({ jobId: job.id, size: finalStat.size, file: finalName }, 'download completed');
        return jobStore.get(job.id);
    } catch (err) {
        jobStore.update(job.id, {
            status: JobStatus.FAILED,
            error: err.message || String(err),
            completedAt: Date.now(),
        });
        // Record the failed attempt in the user's history too.
        recordDownload(jobStore.get(job.id), 'failed').catch(() => {});
        logger.error({ jobId: job.id, err: err.message }, 'download failed');
        throw err;
    }
}

/**
 * yt-dlp writes the final file with the actual extension; the template uses
 * %(ext)s so the real path differs from the template. Find any file in temp
 * whose name starts with the job's id prefix.
 */
function resolveOutputFile(reportedName, job) {
    if (reportedName && path.isAbsolute(reportedName) && fs.existsSync(reportedName)) {
        return reportedName;
    }
    if (reportedName) {
        const candidate = path.join(config.tempDir, path.basename(reportedName));
        if (fs.existsSync(candidate)) return candidate;
    }
    const prefix = sanitizeFilename(job.id).slice(0, 40);
    const files = fs.readdirSync(config.tempDir).filter((f) => f.startsWith(prefix));
    if (files.length === 0) return null;
    // pick the most recently modified
    let best = null;
    let bestMtime = 0;
    for (const f of files) {
        const full = path.join(config.tempDir, f);
        const st = fs.statSync(full);
        if (st.mtimeMs > bestMtime) {
            bestMtime = st.mtimeMs;
            best = full;
        }
    }
    return best;
}

async function safeUnlink(p) {
    try {
        await fsp.unlink(p);
    } catch {
        /* ignore */
    }
}
