import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

function commaList(value, fallback = []) {
  if (!value) return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function resolveDir(p) {
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT || '4000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',

  allowedOrigins: commaList(process.env.ALLOWED_ORIGINS),

  downloadDir: resolveDir(process.env.DOWNLOAD_DIR || 'downloads'),
  tempDir: resolveDir(process.env.TEMP_DIR || 'temp'),

  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10),
  maxDownloadTime: parseInt(process.env.MAX_DOWNLOAD_TIME || '1800', 10),
  maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '3', 10),

  autoDeleteMinutes: parseInt(process.env.AUTO_DELETE_MINUTES || '60', 10),

  ytdlpBin: process.env.YTDLP_BIN || 'yt-dlp',
  ffmpegBin: process.env.FFMPEG_BIN || 'ffmpeg',

  // Cookie authentication for platforms that require login (e.g. Instagram).
  // COOKIES_FILE: path to a Netscape-format cookies.txt file
  // COOKIES_FROM_BROWSER: browser name to extract cookies from (e.g. 'chrome', 'firefox')
  cookiesFile: process.env.COOKIES_FILE || '',
  cookiesFromBrowser: process.env.COOKIES_FROM_BROWSER || '',

  // Safety net only — yt-dlp ops have their own timeout via maxDownloadTime.
  // Set high enough that it never pre-empts a legitimate fetch.
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '300000', 10),
  cleanupIntervalMs: 5 * 60 * 1000,
};

export const ROOT_DIR = ROOT;
