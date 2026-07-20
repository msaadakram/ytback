import { Router } from 'express';
import { login, logout, getMe, changePassword } from './admin.controller.js';
import { listCookies, getCookie, upsertCookie, deleteCookie, testCookie } from './cookies.controller.js';
import { loginSchema, changePasswordSchema, cookieSchema } from './admin.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/auth.js';
import { infoLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

// Auth
router.post('/login', infoLimiter, validate(loginSchema), login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, validate(changePasswordSchema), changePassword);

// Cookies
router.get('/cookies', requireAuth, listCookies);
router.get('/cookies/:platform', requireAuth, getCookie);
router.post('/cookies', requireAuth, validate(cookieSchema), upsertCookie);
router.delete('/cookies/:platform', requireAuth, deleteCookie);
router.get('/cookies/:platform/test', requireAuth, testCookie);

export default router;
