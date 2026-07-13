import { Router } from 'express';
import { getRedditInfo, downloadRedditVideo, downloadRedditAudio } from './reddit.controller.js';
import { rdVideoInfoSchema, rdVideoDownloadSchema, rdAudioDownloadSchema } from './reddit.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(rdVideoInfoSchema), getRedditInfo);
router.post('/download', downloadLimiter, validate(rdVideoDownloadSchema), downloadRedditVideo);
router.post('/audio', downloadLimiter, validate(rdAudioDownloadSchema), downloadRedditAudio);

export default router;
