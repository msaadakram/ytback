import { Router } from 'express';
import { getOverview, getTimeseries, getRecentDownloads, getDownloadsHistory } from './dashboard.controller.js';
import { requireUser } from '../../middlewares/userAuth.js';

const router = Router();

router.get('/overview', requireUser, getOverview);
router.get('/timeseries', requireUser, getTimeseries);
router.get('/recent-downloads', requireUser, getRecentDownloads);
router.get('/downloads', requireUser, getDownloadsHistory);

export default router;
