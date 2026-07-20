import crypto from 'node:crypto';
import { getDb } from './index.js';
import logger from '../utils/logger.js';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

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
