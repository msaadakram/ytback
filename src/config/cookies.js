import fs from 'node:fs';
import path from 'node:path';
import { config } from './index.js';
import logger from '../utils/logger.js';

/**
 * Resolve where yt-dlp should read its cookies from, and materialize them on
 * disk at boot if they were supplied via the YOUTUBE_COOKIES env var (base64 of
 * a Netscape cookies.txt). Keeps login sessions out of git on hosts like
 * Heroku where the repo is public.
 *
 * Priority:
 *   1. COOKIES_FILE env var -> absolute path used as-is.
 *   2. YOUTUBE_COOKIES env var -> base64-decoded, written to tempDir/cookies.txt.
 *   3. cookies.txt in project root (existing fallback).
 *
 * Mutates `config.cookiesFile` so the rest of the app reads the resolved path.
 */
export function ensureCookiesFile() {
  // 1. Explicit path wins; nothing to write.
  if (process.env.COOKIES_FILE) {
    if (fs.existsSync(config.cookiesFile)) {
      logger.info({ source: 'COOKIES_FILE', path: config.cookiesFile }, 'cookies loaded');
    } else {
      logger.warn({ path: config.cookiesFile }, 'COOKIES_FILE set but file missing; proceeding without cookies');
    }
    return;
  }

  // 2. Base64 env var -> materialize to tempDir.
  const raw = process.env.YOUTUBE_COOKIES;
  if (raw && raw.trim()) {
    try {
      const decoded = Buffer.from(raw.trim(), 'base64').toString('utf8');
      fs.mkdirSync(config.tempDir, { recursive: true });
      const target = path.join(config.tempDir, 'cookies.txt');
      fs.writeFileSync(target, decoded, { mode: 0o600 });
      config.cookiesFile = target;
      logger.info({ source: 'YOUTUBE_COOKIES', path: target }, 'cookies materialized');
    } catch (err) {
      logger.error({ err: err.message }, 'failed to materialize YOUTUBE_COOKIES; proceeding without cookies');
    }
    return;
  }

  // 3. Fallback to project-root cookies.txt if present.
  if (fs.existsSync(config.cookiesFileDefault)) {
    config.cookiesFile = config.cookiesFileDefault;
    logger.info({ source: 'default', path: config.cookiesFileDefault }, 'cookies loaded');
  } else {
    logger.info('no cookies configured; requests will be unauthenticated');
  }
}
