import { fetchInfo } from '../../core/ytdlp.js';
import { transcribeAudio } from '../../core/transcription.js';
import { jobStore, JobStatus } from '../../core/jobStore.js';
import { downloadQueue } from '../../queue/index.js';
import { detectPlatform } from '../../utils/platformDetector.js';
import { Errors } from '../../utils/HttpError.js';
import { wrapAsync } from '../../middlewares/error.js';
import { logUsage } from '../../core/usage.js';

/**
 * POST /api/transcribe
 * Accept any URL, auto-detect platform, enqueue a transcription job.
 * The backend downloads audio from the video, transcribes it with Groq Whisper,
 * and returns the transcript text in the job result.
 */
export const transcribeMedia = wrapAsync(async (req, res) => {
    const { url, format } = req.validated;

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
        type: 'transcript',
        platform,
        url,
        format: format || 'txt',
        title,
        userId: req.user?.id || null,
    });

    downloadQueue
        .add(() => transcribeAudio(job))
        .catch((err) => {
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
            type: 'transcript',
            status: 'started',
        },
    });
    logUsage(req.user, 'transcribe', { platform });
});
