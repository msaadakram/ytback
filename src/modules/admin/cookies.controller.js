import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../../db/index.js';
import { cookieStore } from '../../core/cookieStore.js';
import { fetchInfo } from '../../core/ytdlp.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';
import { ROOT_DIR } from '../../config/index.js';
import logger from '../../utils/logger.js';

const COOKIE_DIR = path.resolve(ROOT_DIR, 'data', 'cookies');

const TEST_URLS = {
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  tiktok: 'https://www.tiktok.com/@tiktok',
  instagram: 'https://www.instagram.com/reel/C8T_l0sR6e_/',
  facebook: 'https://www.facebook.com/watch/?v=10153274184191729',
  vimeo: 'https://vimeo.com/76979871',
  twitch: 'https://www.twitch.tv/ninja',
  dailymotion: 'https://www.dailymotion.com/video/x8d5tne',
  reddit: 'https://www.reddit.com/r/videos/comments/6yn8f8/',
  soundcloud: 'https://soundcloud.com/odezsa/odezsa-home',
  kick: 'https://kick.com/xqc',
  snapchat: 'https://www.snapchat.com/spotlight',
  linkedin: 'https://www.linkedin.com/posts/',
  pinterest: 'https://www.pinterest.com/pin/99360735500167749/',
  niconico: 'https://www.nicovideo.jp/watch/sm9',
};

export const listCookies = wrapAsync(async (req, res) => {
  const db = getDb();
  const rows = await db.collection('platform_cookies')
    .find({}, { projection: { _id: 0, platform: 1, notes: 1, updated_at: 1 } })
    .sort({ platform: 1 })
    .toArray();
  res.json({ success: true, data: rows });
});

export const getCookie = wrapAsync(async (req, res) => {
  const { platform } = req.params;
  const db = getDb();
  const row = await db.collection('platform_cookies').findOne({ platform }, { projection: { _id: 0 } });
  if (!row) throw Errors.NotFound(`No cookie for platform: ${platform}`);
  res.json({ success: true, data: row });
});

export const upsertCookie = wrapAsync(async (req, res) => {
  const { platform, cookie_data, notes } = req.validated;

  const db = getDb();
  fs.mkdirSync(COOKIE_DIR, { recursive: true });
  const filePath = path.join(COOKIE_DIR, `${platform}.txt`);
  fs.writeFileSync(filePath, cookie_data, { mode: 0o600 });

  await db.collection('platform_cookies').updateOne(
    { platform },
    {
      $set: {
        cookie_data,
        notes: notes || null,
        updated_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true }
  );

  await cookieStore.reloadPlatform(platform);
  logger.info({ platform }, 'cookie updated');

  res.json({ success: true, data: { platform, updated: true } });
});

export const deleteCookie = wrapAsync(async (req, res) => {
  const { platform } = req.params;
  const db = getDb();
  await db.collection('platform_cookies').deleteOne({ platform });
  cookieStore.removePlatform(platform);
  logger.info({ platform }, 'cookie deleted');
  res.json({ success: true, data: { platform, deleted: true } });
});

export const testCookie = wrapAsync(async (req, res) => {
  const { platform } = req.params;
  const testUrl = TEST_URLS[platform];
  if (!testUrl) {
    throw Errors.BadRequest(`No test URL configured for platform: ${platform}`);
  }

  try {
    const info = await fetchInfo(testUrl, platform, { timeoutMs: 30000 });
    res.json({
      success: true,
      data: {
        title: info.title,
        duration: info.duration,
        uploader: info.uploader || info.channel || null,
        platform,
      },
    });
  } catch (err) {
    res.json({
      success: false,
      error: {
        code: 'COOKIE_TEST_FAILED',
        message: `Cookie test failed for ${platform}: ${err.message}`,
      },
    });
  }
});
