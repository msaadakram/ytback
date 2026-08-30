import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireUser, requireVerifiedUser } from '../../middlewares/userAuth.js';
import { infoLimiter, otpLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/register', infoLimiter, validate(registerSchema), register);
router.post('/login', infoLimiter, validate(loginSchema), login);
router.post('/logout', requireUser, logout);
router.get('/me', requireUser, getMe);
router.post('/change-password', requireVerifiedUser, validate(changePasswordSchema), changePassword);

// Email verification & password reset (code-based, via Resend).
router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', otpLimiter, validate(resendVerificationSchema), resendVerification);
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
