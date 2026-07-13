import { Router } from 'express';
import { getInstagramInfo, downloadInstagramVideo, downloadInstagramAudio } from './instagram.controller.js';
import { igVideoInfoSchema, igVideoDownloadSchema, igAudioDownloadSchema } from './instagram.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(igVideoInfoSchema), getInstagramInfo);
router.post('/download', downloadLimiter, validate(igVideoDownloadSchema), downloadInstagramVideo);
router.post('/audio', downloadLimiter, validate(igAudioDownloadSchema), downloadInstagramAudio);

export default router;
