import { Router } from 'express';
import { getLinkedinInfo, downloadLinkedinVideo, downloadLinkedinAudio } from './linkedin.controller.js';
import { linkedinInfoSchema, linkedinVideoDownloadSchema, linkedinAudioDownloadSchema } from './linkedin.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(linkedinInfoSchema), getLinkedinInfo);
router.post('/download', downloadLimiter, validate(linkedinVideoDownloadSchema), downloadLinkedinVideo);
router.post('/audio', downloadLimiter, validate(linkedinAudioDownloadSchema), downloadLinkedinAudio);

export default router;
