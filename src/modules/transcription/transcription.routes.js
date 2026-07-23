import { Router } from 'express';
import { transcribeMedia } from './transcription.controller.js';
import { transcriptionSchema } from './transcription.validator.js';
import { validate } from '../../middlewares/validate.js';
import { downloadLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/', downloadLimiter, validate(transcriptionSchema), transcribeMedia);

export default router;
