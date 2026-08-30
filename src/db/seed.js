import crypto from 'node:crypto';
import { getDb } from './index.js';
import logger from '../utils/logger.js';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export { hashPassword };

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === verify;
}

export async function seedAdmin() {
  const db = getDb();
  const existing = await db.collection('admins').findOne({}, { projection: { _id: 1 } });
  if (existing) return;

  const hash = hashPassword('admin123');
  await db.collection('admins').insertOne({
    email: 'admin@downforge.me',
    password_hash: hash,
    name: 'Admin',
    created_at: new Date(),
  });
  logger.info('default admin seeded: admin@downforge.me / admin123');
}

export async function migrateEnvCookies() {
  const db = getDb();
  const raw = process.env.YOUTUBE_COOKIES;
  if (raw && raw.trim()) {
    const existing = await db.collection('platform_cookies').findOne({ platform: 'youtube' });
    if (!existing) {
      try {
        const decoded = Buffer.from(raw.trim(), 'base64').toString('utf8');
        await db.collection('platform_cookies').updateOne(
          { platform: 'youtube' },
          {
            $set: {
              cookie_data: decoded,
              updated_at: new Date(),
            },
            $setOnInsert: { created_at: new Date() },
          },
          { upsert: true }
        );
        logger.info('migrated YOUTUBE_COOKIES env var to database');
      } catch (err) {
        logger.error({ err: err.message }, 'failed to migrate YOUTUBE_COOKIES');
      }
    }
  }
}

// ─── Demo user + seeded dashboard data ───

const PLATFORMS = [
  'youtube', 'tiktok', 'instagram', 'facebook', 'vimeo',
  'twitch', 'dailymotion', 'reddit', 'soundcloud',
  'kick', 'snapchat', 'linkedin', 'pinterest', 'niconico',
];

const TITLES = [
  'Rick Astley - Never Gonna Give You Up',
  'Nature Documentary - 4K',
  'Podcast Episode #42',
  'Tutorial - React Hooks',
  'Music Video - FLAC',
  'Live Stream Recording',
  'Thumbnail - maxresdefault',
  'Album - Full Discography',
  'Standup Comedy Special',
  'Product Review Unboxing',
  'Cooking Tutorial Italian Pasta',
  'Travel Vlog Tokyo 2025',
  'Gaming Highlights montage',
  'Fitness Workout Full Session',
];

const AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'aac', 'opus', 'flac'];
const VIDEO_EXTS = ['mp4', 'mkv', 'webm'];

export async function seedDemoUser() {
  const db = getDb();
  const existing = await db.collection('users').findOne({}, { projection: { _id: 1 } });
  if (existing) return existing._id; // already seeded by a prior run or a real signup

  const now = new Date();
  const insert = await db.collection('users').insertOne({
    email: 'demo@downforge.me',
    password_hash: hashPassword('demo1234'),
    name: 'Demo User',
    first_name: 'Demo',
    last_name: 'User',
    plan: 'pro',
    plan_expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    stripe_customer_id: null,
    notifications: {
      email_completed: true,
      weekly_summary: true,
      product_updates: false,
      billing_reminders: true,
    },
    // Seeded demo account is explicitly verified so it can be used without
    // going through the email verification flow (which requires a real inbox).
    email_verified: true,
    created_at: now,
    updated_at: now,
  });

  logger.info('demo user seeded: demo@downforge.me / demo1234');

  // Seed dashboard data for this user so charts/tables are populated.
  await seedDemoData(insert.insertedId);

  return insert.insertedId;
}

export async function seedDemoData(userId) {
  const db = getDb();
  // Only seed if downloads collection is empty for this user.
  const existingCount = await db.collection('downloads').countDocuments({ user_id: userId });
  if (existingCount > 0) return;

  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  const downloads = [];
  const usageEvents = [];

  // Generate ~60 days of usage events and ~35 downloads.
  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const dayTs = now.getTime() - daysAgo * DAY;
    const dayStart = new Date(dayTs);

    // Usage events: 5–25 per day, mix of info/download/audio.
    const eventCount = 5 + Math.floor(Math.random() * 20);
    for (let i = 0; i < eventCount; i++) {
      const hour = Math.floor(Math.random() * 24);
      const created = new Date(dayTs + hour * 60 * 60 * 1000);
      const kind = ['info', 'download', 'audio', 'info', 'info'][Math.floor(Math.random() * 5)];
      const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
      const isError = Math.random() < 0.05;
      usageEvents.push({
        user_id: userId,
        kind,
        platform,
        status: isError ? 'error' : 'success',
        created_at: created,
      });
    }

    // Downloads: 0–2 per day.
    const dlCount = Math.random() < 0.6 ? (Math.random() < 0.7 ? 1 : 2) : 0;
    for (let j = 0; j < dlCount; j++) {
      const hour = Math.floor(Math.random() * 24);
      const created = new Date(dayTs + hour * 60 * 60 * 1000);
      const completed = new Date(created.getTime() + (Math.random() * 5 + 1) * 60 * 1000);
      const type = Math.random() < 0.7 ? 'video' : 'audio';
      const isFailed = Math.random() < 0.08;
      const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
      const ext = type === 'audio'
        ? AUDIO_EXTS[Math.floor(Math.random() * AUDIO_EXTS.length)]
        : VIDEO_EXTS[Math.floor(Math.random() * VIDEO_EXTS.length)];
      const size = isFailed ? 0 : (Math.floor(Math.random() * 500 + 10) * 1024 * 1024);

      downloads.push({
        user_id: userId,
        job_id: crypto.randomUUID(),
        platform,
        type,
        title: TITLES[Math.floor(Math.random() * TITLES.length)],
        filename: isFailed ? null : `${TITLES[0].replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${crypto.randomBytes(4).toString('hex')}.${ext}`,
        source_url: `https://example.com/media/${crypto.randomBytes(4).toString('hex')}`,
        size,
        format_label: type === 'audio'
          ? `${ext.toUpperCase()} • ${[128, 192, 256, 320][Math.floor(Math.random() * 4)]}kbps`
          : `${ext.toUpperCase()} • ${['720p', '1080p', '4K', '480p'][Math.floor(Math.random() * 4)]}`,
        status: isFailed ? 'failed' : 'completed',
        error: isFailed ? 'Download failed: network timeout' : null,
        created_at: created,
        completed_at: completed,
      });
    }
  }

  // Seeded invoices for the billing tab (3 months of Pro).
  const invoices = [];
  for (let i = 0; i < 3; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    invoices.push({
      user_id: userId,
      stripe_invoice_id: null,
      number: `INV-${String(3 - i).padStart(3, '0')}`,
      amount: 9.0,
      currency: 'usd',
      status: 'Paid',
      period_start: month,
      period_end: new Date(now.getFullYear(), now.getMonth() - i + 1, 0),
      hosted_url: null,
      pdf_url: null,
      created_at: month,
    });
  }

  if (downloads.length) await db.collection('downloads').insertMany(downloads);
  if (usageEvents.length) await db.collection('usage_events').insertMany(usageEvents);
  if (invoices.length) await db.collection('invoices').insertMany(invoices);

  logger.info({ downloads: downloads.length, events: usageEvents.length, invoices: invoices.length }, 'demo data seeded');
}
