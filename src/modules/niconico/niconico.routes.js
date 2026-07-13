import { Router } from 'express';
import { getNiconicoInfo, downloadNiconicoVideo, downloadNiconicoAudio } from './niconico.controller.js';
import { niconicoInfoSchema, niconicoVideoDownloadSchema, niconicoAudioDownloadSchema } from './niconico.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(niconicoInfoSchema), getNiconicoInfo);
router.post('/download', downloadLimiter, validate(niconicoVideoDownloadSchema), downloadNiconicoVideo);
router.post('/audio', downloadLimiter, validate(niconicoAudioDownloadSchema), downloadNiconicoAudio);

export default router;
