import { Router } from 'express';
import { getSoundCloudInfo, downloadSoundCloudVideo, downloadSoundCloudAudio } from './soundcloud.controller.js';
import { scInfoSchema, scVideoDownloadSchema, scAudioDownloadSchema } from './soundcloud.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(scInfoSchema), getSoundCloudInfo);
router.post('/download', downloadLimiter, validate(scVideoDownloadSchema), downloadSoundCloudVideo);
router.post('/audio', downloadLimiter, validate(scAudioDownloadSchema), downloadSoundCloudAudio);

export default router;
