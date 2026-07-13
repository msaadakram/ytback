import { Router } from 'express';
import { getTikTokInfo, downloadTikTokVideo, downloadTikTokAudio } from './tiktok.controller.js';
import { ttVideoInfoSchema, ttVideoDownloadSchema, ttAudioDownloadSchema } from './tiktok.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(ttVideoInfoSchema), getTikTokInfo);
router.post('/download', downloadLimiter, validate(ttVideoDownloadSchema), downloadTikTokVideo);
router.post('/audio', downloadLimiter, validate(ttAudioDownloadSchema), downloadTikTokAudio);

export default router;
