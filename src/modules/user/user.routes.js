import { Router } from 'express';
import { getProfile, updateProfile, updateNotifications } from './user.controller.js';
import { updateProfileSchema, updateNotificationsSchema } from './user.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireUser } from '../../middlewares/userAuth.js';

const router = Router();

router.get('/profile', requireUser, getProfile);
router.patch('/profile', requireUser, validate(updateProfileSchema), updateProfile);
router.patch('/notifications', requireUser, validate(updateNotificationsSchema), updateNotifications);

export default router;
