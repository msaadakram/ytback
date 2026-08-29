import { Router } from 'express';
import { getOverview, getTimeseries, getRecentDownloads, getDownloadsHistory } from './dashboard.controller.js';
import { requireVerifiedUser } from '../../middlewares/userAuth.js';

const router = Router();

router.get('/overview', requireVerifiedUser, getOverview);
router.get('/timeseries', requireVerifiedUser, getTimeseries);
router.get('/recent-downloads', requireVerifiedUser, getRecentDownloads);
router.get('/downloads', requireVerifiedUser, getDownloadsHistory);

export default router;
