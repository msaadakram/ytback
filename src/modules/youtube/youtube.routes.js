import { Router } from 'express';
import { getYouTubeInfo, downloadYouTubeVideo, downloadYouTubeAudio } from './youtube.controller.js';
import { ytVideoInfoSchema, ytVideoDownloadSchema, ytAudioDownloadSchema } from './youtube.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(ytVideoInfoSchema), getYouTubeInfo);
router.post('/download', downloadLimiter, validate(ytVideoDownloadSchema), downloadYouTubeVideo);
router.post('/audio', downloadLimiter, validate(ytAudioDownloadSchema), downloadYouTubeAudio);

export default router;
