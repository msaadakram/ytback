import { Router } from 'express';
import { listKeys, createKey, deleteKey } from './apikeys.controller.js';
import { createKeySchema } from './apikeys.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireVerifiedUser } from '../../middlewares/userAuth.js';
import { infoLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.get('/', requireVerifiedUser, listKeys);
router.post('/', requireVerifiedUser, infoLimiter, validate(createKeySchema), createKey);
router.delete('/:id', requireVerifiedUser, deleteKey);

export default router;
