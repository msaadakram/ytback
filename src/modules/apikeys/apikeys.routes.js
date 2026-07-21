import { Router } from 'express';
import { listKeys, createKey, deleteKey } from './apikeys.controller.js';
import { createKeySchema } from './apikeys.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireUser } from '../../middlewares/userAuth.js';
import { infoLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.get('/', requireUser, listKeys);
router.post('/', requireUser, infoLimiter, validate(createKeySchema), createKey);
router.delete('/:id', requireUser, deleteKey);

export default router;
