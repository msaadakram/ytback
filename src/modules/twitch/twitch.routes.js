import { Router } from 'express';
import { getTwitchInfo, downloadTwitchVideo, downloadTwitchAudio } from './twitch.controller.js';
import { twVideoInfoSchema, twVideoDownloadSchema, twAudioDownloadSchema } from './twitch.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(twVideoInfoSchema), getTwitchInfo);
router.post('/download', downloadLimiter, validate(twVideoDownloadSchema), downloadTwitchVideo);
router.post('/audio', downloadLimiter, validate(twAudioDownloadSchema), downloadTwitchAudio);

export default router;
