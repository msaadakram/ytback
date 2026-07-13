import { Router } from 'express';
import { getVimeoInfo, downloadVimeoVideo, downloadVimeoAudio } from './vimeo.controller.js';
import { vmVideoInfoSchema, vmVideoDownloadSchema, vmAudioDownloadSchema } from './vimeo.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(vmVideoInfoSchema), getVimeoInfo);
router.post('/download', downloadLimiter, validate(vmVideoDownloadSchema), downloadVimeoVideo);
router.post('/audio', downloadLimiter, validate(vmAudioDownloadSchema), downloadVimeoAudio);

export default router;
