import { Router } from 'express';
import { getProfile, updateProfile, updateNotifications } from './user.controller.js';
import { updateProfileSchema, updateNotificationsSchema } from './user.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireVerifiedUser } from '../../middlewares/userAuth.js';

const router = Router();

router.get('/profile', requireVerifiedUser, getProfile);
router.patch('/profile', requireVerifiedUser, validate(updateProfileSchema), updateProfile);
router.patch('/notifications', requireVerifiedUser, validate(updateNotificationsSchema), updateNotifications);

export default router;
