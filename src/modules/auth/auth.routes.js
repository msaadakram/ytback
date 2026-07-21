import { Router } from 'express';
import { register, login, logout, getMe, changePassword } from './auth.controller.js';
import { registerSchema, loginSchema, changePasswordSchema } from './auth.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireUser } from '../../middlewares/userAuth.js';
import { infoLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/register', infoLimiter, validate(registerSchema), register);
router.post('/login', infoLimiter, validate(loginSchema), login);
router.post('/logout', requireUser, logout);
router.get('/me', requireUser, getMe);
router.post('/change-password', requireUser, validate(changePasswordSchema), changePassword);

export default router;
