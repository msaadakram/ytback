import { fetchInfo } from '../../core/ytdlp.js';
import { downloadVideo, downloadAudio } from '../../core/download.js';
import { jobStore, JobStatus } from '../../core/jobStore.js';
import { downloadQueue } from '../../queue/index.js';
import { formatBytes, formatDuration } from '../../utils/format.js';
import { wrapAsync } from '../../middlewares/error.js';

/* ─── helpers ─── */

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
        filesizeStr: formatBytes(f.filesize ?? f.filesize_approx ?? 0),
        qualityLabel: f.format_note || null,
        protocol: f.protocol,
        url: undefined,
    };
}

/* ─── handlers ─── */

export const getVimeoInfo = wrapAsync(async (req, res) => {
    const { url } = req.validated;
    const info = await fetchInfo(url, 'vimeo');

    const isVideo = (f) => f.vcodec && f.vcodec !== 'none';
    const isAudio = (f) => f.acodec && f.acodec !== 'none';
    const formats = Array.isArray(info.formats) ? info.formats : [];

    const data = {
        id: info.id,
        platform: 'vimeo',
        title: info.title || info.description,
        url: info.original_url || info.webpage_url,
        duration: info.duration,
        durationStr: formatDuration(info.duration),
        thumbnail: info.thumbnail,
        uploader: info.uploader || info.creator,
        channel: info.channel || info.uploader,
        uploadDate: info.upload_date,
        description: info.description,
        viewCount: info.view_count,
        likeCount: info.like_count,
        extractor: info.extractor_key,
        videoFormats: formats.filter(isVideo).map(mapFormat),
        audioFormats: formats.filter(isAudio).map(mapFormat),
        bestFormat: info.format_id ? mapFormat(info) : null,
        filesize: info.filesize ?? info.filesize_approx ?? null,
    };

    res.json({ success: true, data });
});

export const downloadVimeoVideo = wrapAsync(async (req, res) => {
    const { url, formatId, quality, container } = req.validated;

    let title;
    try {
        const info = await fetchInfo(url, 'vimeo');
        title = info.title || info.description || 'vimeo-video';
    } catch {
        title = 'vimeo-video';
    }

    const job = jobStore.create({ type: 'video', platform: 'vimeo', url, formatId, quality, container, title });

    downloadQueue
        .add(() => downloadVideo(job))
        .catch((err) => {
            jobStore.update(job.id, {
                status: JobStatus.FAILED,
                error: err.message || String(err),
                completedAt: Date.now(),
            });
        });

    res.status(202).json({ success: true, data: { jobId: job.id, platform: 'vimeo', status: 'started' } });
});

export const downloadVimeoAudio = wrapAsync(async (req, res) => {
    const { url, format, quality } = req.validated;

    let title;
    try {
        const info = await fetchInfo(url, 'vimeo');
        title = info.title || info.description || 'vimeo-audio';
    } catch {
        title = 'vimeo-audio';
    }

    const job = jobStore.create({ type: 'audio', platform: 'vimeo', url, format, quality, title });

    downloadQueue
        .add(() => downloadAudio(job))
        .catch((err) => {
            jobStore.update(job.id, {
                status: JobStatus.FAILED,
                error: err.message || String(err),
                completedAt: Date.now(),
            });
        });

    res.status(202).json({ success: true, data: { jobId: job.id, platform: 'vimeo', status: 'started' } });
});
