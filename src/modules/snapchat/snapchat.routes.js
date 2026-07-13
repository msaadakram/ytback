import { Router } from 'express';
import { getSnapchatInfo, downloadSnapchatVideo, downloadSnapchatAudio } from './snapchat.controller.js';
import { snapchatInfoSchema, snapchatVideoDownloadSchema, snapchatAudioDownloadSchema } from './snapchat.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(snapchatInfoSchema), getSnapchatInfo);
router.post('/download', downloadLimiter, validate(snapchatVideoDownloadSchema), downloadSnapchatVideo);
router.post('/audio', downloadLimiter, validate(snapchatAudioDownloadSchema), downloadSnapchatAudio);

export default router;
