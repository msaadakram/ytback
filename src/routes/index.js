import { Router } from 'express';
import { health, getCapabilities } from '../controllers/healthController.js';
import { getJobStatus, getJobResult } from '../controllers/downloadController.js';
import { downloadFile } from '../controllers/fileController.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import apiKeysRoutes from '../modules/apikeys/apikeys.routes.js';
import billingRoutes from '../modules/billing/billing.routes.js';
import youtubeRoutes from '../modules/youtube/youtube.routes.js';
import tiktokRoutes from '../modules/tiktok/tiktok.routes.js';
import instagramRoutes from '../modules/instagram/instagram.routes.js';
import facebookRoutes from '../modules/facebook/facebook.routes.js';
import vimeoRoutes from '../modules/vimeo/vimeo.routes.js';
import twitchRoutes from '../modules/twitch/twitch.routes.js';
import dailymotionRoutes from '../modules/dailymotion/dailymotion.routes.js';
import redditRoutes from '../modules/reddit/reddit.routes.js';
import soundcloudRoutes from '../modules/soundcloud/soundcloud.routes.js';

import kickRoutes from '../modules/kick/kick.routes.js';
import snapchatRoutes from '../modules/snapchat/snapchat.routes.js';
import linkedinRoutes from '../modules/linkedin/linkedin.routes.js';
import pinterestRoutes from '../modules/pinterest/pinterest.routes.js';
import niconicoRoutes from '../modules/niconico/niconico.routes.js';
import universalRoutes from '../modules/universal/universal.routes.js';
import transcriptionRoutes from '../modules/transcription/transcription.routes.js';
import contactRoutes from '../modules/contact/contact.routes.js';
import { optionalAuth } from '../middlewares/userAuth.js';
import {
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from '../modules/auth/auth.controller.js';
import {
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../modules/auth/auth.validator.js';
import { validate } from '../middlewares/validate.js';
import { otpLimiter } from '../middlewares/rateLimit.js';

const router = Router();

// Shared endpoints
router.get('/health', health);
router.get('/capabilities', getCapabilities);

// ─── User-facing modules (require full auth) ───
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/api-keys', apiKeysRoutes);
router.use('/billing', billingRoutes);

// ─── Public marketing / support forms (anonymous) ───
// POST /api/newsletter/subscribe → footer newsletter
router.use('/newsletter', contactRoutes);
// POST /api/contact → contact page "Send us a message"
router.use('/contact', contactRoutes);

// ─── Optional auth middleware: attaches req.user when a valid token/key is ───
// present, sets req.user = null otherwise. Does NOT block anonymous requests.
router.use(optionalAuth);

// Platform modules (now have access to req.user for download attribution)
router.use('/youtube', youtubeRoutes);
router.use('/tiktok', tiktokRoutes);
router.use('/instagram', instagramRoutes);
router.use('/facebook', facebookRoutes);
router.use('/vimeo', vimeoRoutes);
router.use('/twitch', twitchRoutes);
router.use('/dailymotion', dailymotionRoutes);
router.use('/reddit', redditRoutes);
router.use('/soundcloud', soundcloudRoutes);

router.use('/kick', kickRoutes);
router.use('/snapchat', snapchatRoutes);
router.use('/linkedin', linkedinRoutes);
router.use('/pinterest', pinterestRoutes);
router.use('/niconico', niconicoRoutes);

// Transcription endpoint — auto-detect platform for any URL
router.use('/transcribe', transcriptionRoutes);

// Admin (must be before universal catch-all)
router.use('/admin', adminRoutes);

// ─── Fallback aliases for auth code endpoints ───────────────────────────
// Some deployments/proxies may call the endpoint without the /auth prefix
// (e.g. /api/forgot-password) — e.g. if the frontend proxy was ever
// misconfigured to strip the prefix. These aliases ensure the client never
// sees a spurious 404 for a valid auth operation.
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', otpLimiter, validate(resendVerificationSchema), resendVerification);
router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), resetPassword);

// Universal endpoint — auto-detect platform for any URL
// NOTE: mounted last among the platform routes so it does not shadow
// /auth/*, /admin/*, etc. Express falls through to next router when
// no route matches, but keeping it last is more explicit and avoids
// accidental shadowing if a future universal route uses a generic pattern.
router.use('/', universalRoutes);

// Job tracking (shared across platforms)
router.get('/job/:id', getJobStatus);
router.get('/job/:id/result', getJobResult);

// File serving
export const downloadRouter = Router();
downloadRouter.get('/:filename', downloadFile);

export default router;
