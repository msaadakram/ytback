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
  const rows = db.prepare('SELECT platform, notes, updated_at FROM platform_cookies ORDER BY platform').all();
  res.json({ success: true, data: rows });
});

export const getCookie = wrapAsync(async (req, res) => {
  const { platform } = req.params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM platform_cookies WHERE platform = ?').get(platform);
  if (!row) throw Errors.NotFound(`No cookie for platform: ${platform}`);
  res.json({ success: true, data: row });
});

export const upsertCookie = wrapAsync(async (req, res) => {
  const { platform, cookie_data, notes } = req.validated;

  const db = getDb();
  fs.mkdirSync(COOKIE_DIR, { recursive: true });
  const filePath = path.join(COOKIE_DIR, `${platform}.txt`);
  fs.writeFileSync(filePath, cookie_data, { mode: 0o600 });

  db.prepare(`
    INSERT INTO platform_cookies (platform, cookie_data, notes, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(platform) DO UPDATE SET
      cookie_data = excluded.cookie_data,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(platform, cookie_data, notes || null);

  cookieStore.reloadPlatform(platform);
  logger.info({ platform }, 'cookie updated');

  res.json({ success: true, data: { platform, updated: true } });
});

export const deleteCookie = wrapAsync(async (req, res) => {
  const { platform } = req.params;
  const db = getDb();
  db.prepare('DELETE FROM platform_cookies WHERE platform = ?').run(platform);
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
