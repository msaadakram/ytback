import { Router } from 'express';
import {
  getUniversalInfo,
  downloadUniversalVideo,
  downloadUniversalAudio,
} from './universal.controller.js';
import {
  universalInfoSchema,
  universalVideoDownloadSchema,
  universalAudioDownloadSchema,
} from './universal.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(universalInfoSchema), getUniversalInfo);
router.post('/download', downloadLimiter, validate(universalVideoDownloadSchema), downloadUniversalVideo);
router.post('/audio', downloadLimiter, validate(universalAudioDownloadSchema), downloadUniversalAudio);

export default router;
