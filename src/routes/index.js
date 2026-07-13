import { Router } from 'express';
import { health, getCapabilities } from '../controllers/healthController.js';
import { getJobStatus, getJobResult } from '../controllers/downloadController.js';
import { downloadFile } from '../controllers/fileController.js';
import youtubeRoutes from '../modules/youtube/youtube.routes.js';
import tiktokRoutes from '../modules/tiktok/tiktok.routes.js';
import instagramRoutes from '../modules/instagram/instagram.routes.js';
import facebookRoutes from '../modules/facebook/facebook.routes.js';
import vimeoRoutes from '../modules/vimeo/vimeo.routes.js';
import twitchRoutes from '../modules/twitch/twitch.routes.js';
import dailymotionRoutes from '../modules/dailymotion/dailymotion.routes.js';
import redditRoutes from '../modules/reddit/reddit.routes.js';
import soundcloudRoutes from '../modules/soundcloud/soundcloud.routes.js';

import bilibiliRoutes from '../modules/bilibili/bilibili.routes.js';
import kickRoutes from '../modules/kick/kick.routes.js';
import snapchatRoutes from '../modules/snapchat/snapchat.routes.js';
import linkedinRoutes from '../modules/linkedin/linkedin.routes.js';
import pinterestRoutes from '../modules/pinterest/pinterest.routes.js';
import niconicoRoutes from '../modules/niconico/niconico.routes.js';

const router = Router();

// Shared endpoints
router.get('/health', health);
router.get('/capabilities', getCapabilities);

// Platform modules
router.use('/youtube', youtubeRoutes);
router.use('/tiktok', tiktokRoutes);
router.use('/instagram', instagramRoutes);
router.use('/facebook', facebookRoutes);
router.use('/vimeo', vimeoRoutes);
router.use('/twitch', twitchRoutes);
router.use('/dailymotion', dailymotionRoutes);
router.use('/reddit', redditRoutes);
router.use('/soundcloud', soundcloudRoutes);

router.use('/bilibili', bilibiliRoutes);
router.use('/kick', kickRoutes);
router.use('/snapchat', snapchatRoutes);
router.use('/linkedin', linkedinRoutes);
router.use('/pinterest', pinterestRoutes);
router.use('/niconico', niconicoRoutes);

// Job tracking (shared across platforms)
router.get('/job/:id', getJobStatus);
router.get('/job/:id/result', getJobResult);

// File serving
export const downloadRouter = Router();
downloadRouter.get('/:filename', downloadFile);

export default router;
