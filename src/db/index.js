import { MongoClient, ObjectId } from 'mongodb';
import { config, ROOT_DIR } from '../config/index.js';
import logger from '../utils/logger.js';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'downforge';

let client;
let db;

export async function connectDb() {
  if (db) return db;

  client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(DB_NAME);

  await db.collection('admins').createIndex({ email: 1 }, { unique: true });
  await db.collection('platform_cookies').createIndex({ platform: 1 }, { unique: true });

  // User + dashboard collections
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('user_sessions').createIndex({ id: 1 }, { unique: true });
  await db.collection('api_keys').createIndex({ user_id: 1 });
  await db.collection('api_keys').createIndex({ key_hash: 1 }, { unique: true });
  await db.collection('downloads').createIndex({ user_id: 1, created_at: -1 });
  await db.collection('invoices').createIndex({ user_id: 1, created_at: -1 });
  await db.collection('usage_events').createIndex({ user_id: 1, created_at: -1 });

  logger.info({ uri: URI, db: DB_NAME }, 'mongodb connected');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectDb() during boot.');
  }
  return db;
}

export function getClient() {
  return client;
}

export function closeDb() {
  if (client) {
    return client.close().then(() => {
      client = null;
      db = null;
    });
  }
}

export { ObjectId };
