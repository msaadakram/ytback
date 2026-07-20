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
