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

export function seedAdmin() {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (existing) return;

  const hash = hashPassword('admin123');
  db.prepare('INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)')
    .run('admin@downforge.me', hash, 'Admin');
  logger.info('default admin seeded: admin@downforge.me / admin123');
}

export function migrateEnvCookies() {
  const db = getDb();
  const raw = process.env.YOUTUBE_COOKIES;
  if (raw && raw.trim()) {
    const existing = db.prepare('SELECT id FROM platform_cookies WHERE platform = ?').get('youtube');
    if (!existing) {
      try {
        const decoded = Buffer.from(raw.trim(), 'base64').toString('utf8');
        db.prepare('INSERT OR IGNORE INTO platform_cookies (platform, cookie_data) VALUES (?, ?)')
          .run('youtube', decoded);
        logger.info('migrated YOUTUBE_COOKIES env var to database');
      } catch (err) {
        logger.error({ err: err.message }, 'failed to migrate YOUTUBE_COOKIES');
      }
    }
  }
}
