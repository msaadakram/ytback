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
import { optionalAuth } from '../middlewares/userAuth.js';

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

// Universal endpoint — auto-detect platform for any URL
router.use('/', universalRoutes);

// Admin
router.use('/admin', adminRoutes);

// Job tracking (shared across platforms)
router.get('/job/:id', getJobStatus);
router.get('/job/:id/result', getJobResult);

// File serving
export const downloadRouter = Router();
downloadRouter.get('/:filename', downloadFile);

export default router;
