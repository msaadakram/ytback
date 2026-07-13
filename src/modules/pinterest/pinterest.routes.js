import { Router } from 'express';
import { getPinterestInfo, downloadPinterestVideo, downloadPinterestAudio } from './pinterest.controller.js';
import { pinterestInfoSchema, pinterestVideoDownloadSchema, pinterestAudioDownloadSchema } from './pinterest.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(pinterestInfoSchema), getPinterestInfo);
router.post('/download', downloadLimiter, validate(pinterestVideoDownloadSchema), downloadPinterestVideo);
router.post('/audio', downloadLimiter, validate(pinterestAudioDownloadSchema), downloadPinterestAudio);

export default router;
