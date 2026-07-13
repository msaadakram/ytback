import { Router } from 'express';
import { getKickInfo, downloadKickVideo, downloadKickAudio } from './kick.controller.js';
import { kickInfoSchema, kickVideoDownloadSchema, kickAudioDownloadSchema } from './kick.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(kickInfoSchema), getKickInfo);
router.post('/download', downloadLimiter, validate(kickVideoDownloadSchema), downloadKickVideo);
router.post('/audio', downloadLimiter, validate(kickAudioDownloadSchema), downloadKickAudio);

export default router;
