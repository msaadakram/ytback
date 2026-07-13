import { Router } from 'express';
import { getDailymotionInfo, downloadDailymotionVideo, downloadDailymotionAudio } from './dailymotion.controller.js';
import { dmVideoInfoSchema, dmVideoDownloadSchema, dmAudioDownloadSchema } from './dailymotion.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(dmVideoInfoSchema), getDailymotionInfo);
router.post('/download', downloadLimiter, validate(dmVideoDownloadSchema), downloadDailymotionVideo);
router.post('/audio', downloadLimiter, validate(dmAudioDownloadSchema), downloadDailymotionAudio);

export default router;
