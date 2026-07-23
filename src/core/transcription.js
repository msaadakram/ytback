import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import Groq from 'groq-sdk';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { Errors } from '../utils/HttpError.js';
import { sanitizeFilename, formatBytes } from '../utils/format.js';
import { runDownload } from './ytdlp.js';
import { JobStatus, jobStore } from './jobStore.js';
import { recordDownload } from './usage.js';

/**
 * Maximum audio file size for Groq Whisper API (25 MB).
 * @see https://docs.groq.com/api-reference/audio-transcription
 */
const GROQ_MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Build a yt-dlp output template for a temp audio file.
 */
function outTemplate(jobId, ext) {
    const safeId = sanitizeFilename(jobId).slice(0, 40);
    return path.join(config.tempDir, `${safeId}_${Date.now()}.%(ext)s`);
}

/**
 * Resolve the actual output file from yt-dlp's reported filename or by
 * scanning the temp directory for files matching the job id prefix.
 * Prefers files with audio extensions (.m4a, .mp3, .wav, etc.).
 */
function resolveOutputFile(reportedName, job) {
    const AUDIO_EXTS = ['.m4a', '.mp3', '.wav', '.aac', '.opus', '.flac', '.ogg', '.webm', '.mp4', '.mkv'];

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

    // Prefer files with audio extensions, then fall back to newest file
    const audioFiles = files.filter((f) => AUDIO_EXTS.includes(path.extname(f).toLowerCase()));
    const candidates = audioFiles.length > 0 ? audioFiles : files;

    let best = null;
    let bestMtime = 0;
    for (const f of candidates) {
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

/**
 * Build platform-specific extractor args for yt-dlp.
 * Different platforms need different extractor args to work reliably.
 */
function buildExtractorArgs(platform) {
    const args = [];

    // Always include generic impersonation for better compatibility
    args.push('--extractor-args', 'generic:impersonate');

    // YouTube needs android client for better format availability
    args.push('--extractor-args', 'youtube:player_client=android,web');

    // Facebook requires specific extractor args to bypass restrictions
    if (platform === 'facebook') {
        args.push('--extractor-args', 'facebook:skip=dash,stories');
    }

    return args;
}

/**
 * Extract audio from a video URL using yt-dlp.
 * Downloads to a temp .m4a file and returns the file path.
 */
async function extractAudio(job) {
    const outTpl = outTemplate(job.id, 'm4a');
    const args = [
        '--no-warnings',
        '--no-playlist',
        '--newline',
        '--no-mtime',
        '--no-check-certificate',
        ...buildExtractorArgs(job.platform),
        '-o', outTpl,
        '-x', // extract audio
        '--audio-format', 'm4a',
        '--audio-quality', '0',
        job.url,
    ];

    // Inject ffmpeg location if configured as an absolute path
    const ffmpegBin = config.ffmpegBin;
    if (ffmpegBin && path.isAbsolute(ffmpegBin)) {
        args.unshift('--ffmpeg-location', path.dirname(ffmpegBin));
    }

    jobStore.update(job.id, { status: JobStatus.DOWNLOADING, startedAt: Date.now() });
    logger.info({ jobId: job.id, type: 'transcript', platform: job.platform }, 'audio extraction started');

    let lastFilename = null;

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
        throw Errors.DownloadFailed('Audio file not found after extraction');
    }

    return target;
}

/**
 * Transcribe an audio file using Groq Whisper API.
 * Returns { text, segments } where segments is an array of { start, end, text }.
 */
async function transcribeWithGroq(audioPath) {
    if (!config.groqApiKey) {
        throw Errors.Internal('Groq API key not configured. Set GROQ_API_KEY in your environment.');
    }

    const stat = await fsp.stat(audioPath);
    if (stat.size > GROQ_MAX_AUDIO_BYTES) {
        throw Errors.ValidationError(
            `Audio file is too large for transcription (${formatBytes(stat.size)}). ` +
            `Maximum is ${formatBytes(GROQ_MAX_AUDIO_BYTES)}. ` +
            'Try a shorter video or use a platform with native captions.',
        );
    }

    const groq = new Groq({ apiKey: config.groqApiKey });

    logger.info({ jobId: audioPath, size: stat.size }, 'sending audio to Groq Whisper');

    const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-large-v3',
        temperature: 0,
        response_format: 'verbose_json',
    });

    const text = transcription.text || '';
    const segments = Array.isArray(transcription.segments)
        ? transcription.segments.map((s) => ({
            start: s.start,
            end: s.end,
            text: s.text,
        }))
        : [];

    logger.info({ segments: segments.length, textLength: text.length }, 'transcription complete');

    return { text, segments };
}

/**
 * Save transcript text and structured JSON to the downloads directory.
 * Returns { txtPath, jsonPath, txtFilename, jsonFilename }.
 */
async function saveTranscript(job, text, segments) {
    const safeTitle = sanitizeFilename(job.title || 'transcript').slice(0, 80) || 'transcript';
    const jobIdShort = job.id.slice(0, 8);

    const txtFilename = `${safeTitle}_${jobIdShort}.txt`;
    const jsonFilename = `${safeTitle}_${jobIdShort}.json`;

    const txtPath = path.join(config.downloadDir, txtFilename);
    const jsonPath = path.join(config.downloadDir, jsonFilename);

    // Save plain text transcript
    await fsp.writeFile(txtPath, text, 'utf8');

    // Save structured JSON with segments
    const jsonContent = JSON.stringify(
        {
            title: job.title || 'transcript',
            platform: job.platform || 'unknown',
            url: job.url,
            createdAt: new Date().toISOString(),
            text,
            segments,
        },
        null,
        2,
    );
    await fsp.writeFile(jsonPath, jsonContent, 'utf8');

    return { txtPath, jsonPath, txtFilename, jsonFilename };
}

/**
 * Main transcription pipeline:
 * 1. Extract audio from video URL
 * 2. Transcribe with Groq Whisper
 * 3. Save transcript files
 * 4. Update job store
 */
export async function transcribeAudio(job) {
    jobStore.update(job.id, { status: JobStatus.PROCESSING });
    logger.info({ jobId: job.id, platform: job.platform }, 'transcription job started');

    let audioPath = null;

    try {
        // Step 1: Extract audio
        jobStore.update(job.id, { status: JobStatus.DOWNLOADING, progress: 0 });
        audioPath = await extractAudio(job);

        // Step 2: Transcribe with Groq
        jobStore.update(job.id, { status: JobStatus.PROCESSING, progress: 50 });
        const { text, segments } = await transcribeWithGroq(audioPath);

        // Step 3: Save transcript files
        jobStore.update(job.id, { status: JobStatus.PROCESSING, progress: 80 });
        const { txtPath, jsonPath, txtFilename, jsonFilename } = await saveTranscript(job, text, segments);

        // Step 4: Update job store with results
        const txtStat = await fsp.stat(txtPath);
        const jsonStat = await fsp.stat(jsonPath);

        jobStore.update(job.id, {
            status: JobStatus.COMPLETED,
            progress: 100,
            transcript: text,
            segments,
            filename: txtFilename,
            filepath: txtPath,
            size: txtStat.size,
            downloadUrl: `/download/${txtFilename}`,
            jsonFilename,
            jsonDownloadUrl: `/download/${jsonFilename}`,
            jsonSize: jsonStat.size,
            completedAt: Date.now(),
        });

        // Persist to user's download history (no-op for anonymous jobs)
        recordDownload(jobStore.get(job.id), 'completed').catch(() => {});

        logger.info(
            { jobId: job.id, textLength: text.length, segments: segments.length, size: txtStat.size },
            'transcription completed',
        );

        return jobStore.get(job.id);
    } catch (err) {
        jobStore.update(job.id, {
            status: JobStatus.FAILED,
            error: err.message || String(err),
            completedAt: Date.now(),
        });
        recordDownload(jobStore.get(job.id), 'failed').catch(() => {});
        logger.error({ jobId: job.id, err: err.message }, 'transcription failed');
        throw err;
    } finally {
        // Clean up the temp audio file
        if (audioPath) {
            await safeUnlink(audioPath);
        }
    }
}
