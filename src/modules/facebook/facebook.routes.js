import { Router } from 'express';
import { getFacebookInfo, downloadFacebookVideo, downloadFacebookAudio } from './facebook.controller.js';
import { fbVideoInfoSchema, fbVideoDownloadSchema, fbAudioDownloadSchema } from './facebook.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(fbVideoInfoSchema), getFacebookInfo);
router.post('/download', downloadLimiter, validate(fbVideoDownloadSchema), downloadFacebookVideo);
router.post('/audio', downloadLimiter, validate(fbAudioDownloadSchema), downloadFacebookAudio);

export default router;
