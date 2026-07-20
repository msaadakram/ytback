import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT_DIR } from '../config/index.js';
import { getDb } from '../db/index.js';
import logger from '../utils/logger.js';

const COOKIE_DIR = path.resolve(ROOT_DIR, 'data', 'cookies');

class CookieStore {
  constructor() {
    this.platformCookies = new Map();
  }

  async loadFromDb() {
    try {
      const db = getDb();
      const rows = await db.collection('platform_cookies').find({}).toArray();

      fs.mkdirSync(COOKIE_DIR, { recursive: true });

      for (const row of rows) {
        const filePath = path.join(COOKIE_DIR, `${row.platform}.txt`);
        fs.writeFileSync(filePath, row.cookie_data, { mode: 0o600 });
        this.platformCookies.set(row.platform, filePath);
      }

      logger.info({ platforms: Array.from(this.platformCookies.keys()) }, 'cookie store loaded');
    } catch (err) {
      logger.error({ err: err.message }, 'failed to load cookie store from db — db may not be ready yet');
    }
  }

  getCookieFile(platform) {
    const filePath = this.platformCookies.get(platform);
    if (filePath && fs.existsSync(filePath)) {
      return filePath;
    }
    const defaultPath = path.resolve(ROOT_DIR, 'cookies.txt');
    if (fs.existsSync(defaultPath)) {
      return defaultPath;
    }
    return null;
  }

  async reloadPlatform(platform) {
    try {
      const db = getDb();
      const row = await db.collection('platform_cookies').findOne({ platform });
      if (row) {
        const filePath = path.join(COOKIE_DIR, `${platform}.txt`);
        fs.writeFileSync(filePath, row.cookie_data, { mode: 0o600 });
        this.platformCookies.set(platform, filePath);
      } else {
        this.platformCookies.delete(platform);
        const filePath = path.join(COOKIE_DIR, `${platform}.txt`);
        try { fs.unlinkSync(filePath); } catch {}
      }
    } catch (err) {
      logger.error({ err: err.message, platform }, 'failed to reload platform cookie');
    }
  }

  removePlatform(platform) {
    this.platformCookies.delete(platform);
    const filePath = path.join(COOKIE_DIR, `${platform}.txt`);
    try { fs.unlinkSync(filePath); } catch {}
  }
}

export const cookieStore = new CookieStore();
