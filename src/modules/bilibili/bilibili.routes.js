import { Router } from 'express';
import { getBilibiliInfo, downloadBilibiliVideo, downloadBilibiliAudio } from './bilibili.controller.js';
import { bilibiliInfoSchema, bilibiliVideoDownloadSchema, bilibiliAudioDownloadSchema } from './bilibili.validator.js';
import { validate } from '../../middlewares/validate.js';
import { infoLimiter, downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/info', infoLimiter, validate(bilibiliInfoSchema), getBilibiliInfo);
router.post('/download', downloadLimiter, validate(bilibiliVideoDownloadSchema), downloadBilibiliVideo);
router.post('/audio', downloadLimiter, validate(bilibiliAudioDownloadSchema), downloadBilibiliAudio);

export default router;
