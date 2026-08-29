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

  ytdlpBin: process.env.YTDLP_BIN || path.resolve(ROOT, 'bin', 'yt-dlp'),
  ffmpegBin: process.env.FFMPEG_BIN || path.resolve(ROOT, 'bin', 'ffmpeg', 'ffmpeg'),

  // Cookie authentication for platforms that require login (e.g. Instagram).
  // COOKIES_FILE: path to a Netscape-format cookies.txt file
  // COOKIES_FROM_BROWSER: browser name to extract cookies from (e.g. 'chrome', 'firefox')
  cookiesFile: process.env.COOKIES_FILE || '',
  cookiesFromBrowser: process.env.COOKIES_FROM_BROWSER || '',
  cookiesFileDefault: path.resolve(ROOT, 'cookies.txt'),

  // MongoDB connection (persists admins, sessions, per-platform cookies).
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGODB_DB || 'downforge',

  // Safety net only — yt-dlp ops have their own timeout via maxDownloadTime.
  // Set high enough that it never pre-empts a legitimate fetch.
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '300000', 10),
  cleanupIntervalMs: 5 * 60 * 1000,

  // User sessions (UUID tokens, 30d default) and app base URL.
  userSessionTtlHours: parseInt(process.env.USER_SESSION_TTL_HOURS || '720', 10),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',

  // Resend (https://resend.com) transactional email delivery. Optional —
  // verification/reset emails degrade to log output when RESEND_API_KEY is
  // unset, so local development still works without a mail provider.
  // RESEND_FROM must use a domain verified in your Resend dashboard.
  // Default uses ytforge.app which is fully verified; downforge.me is also
  // verified but currently partially_verified. Using onboarding@resend.dev
  // only works for the Resend account owner's own email, so we avoid it.
  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.RESEND_FROM || 'DownForge <noreply@ytforge.app>',

  // Email verification / password reset codes.
  emailCodeTtlMinutes: parseInt(process.env.EMAIL_CODE_TTL_MINUTES || '10', 10),
  emailCodeResendSeconds: parseInt(process.env.EMAIL_CODE_RESEND_SECONDS || '60', 10),
  emailCodeMaxAttempts: parseInt(process.env.EMAIL_CODE_MAX_ATTEMPTS || '6', 10),
  passwordResetTtlMinutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || '15', 10),

  // Groq API key for Whisper transcription.
  groqApiKey: process.env.GROQ_API_KEY || '',

  // Stripe (optional — billing degrades gracefully when unset).
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
};

export const ROOT_DIR = ROOT;
