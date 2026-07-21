import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { Errors } from '../utils/HttpError.js';

/** Hash an API key for storage/lookup using sha256 (plaintext is shown only once). */
export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export const API_KEY_PREFIX = 'df_live_';

/** Generate a new full API key: df_live_<32 hex>. */
export function generateApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Resolve a Bearer token to a user session (UUID-based, mirrors admin auth).
 * Returns the user document shape or null.
 */
async function resolveUserSession(db, token) {
  const session = await db.collection('user_sessions').aggregate([
    { $match: { id: token, expires_at: { $gt: new Date() } } },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
  ]).next();

  if (!session) return null;
  return session.user;
}

/** Resolve an API key (df_live_…) to a user. Updates last_used_at. Returns null if not found/revoked. */
async function resolveApiKey(db, key) {
  if (!key || !key.startsWith(API_KEY_PREFIX)) return null;
  const keyHash = hashApiKey(key);
  const apiKey = await db.collection('api_keys').findOne(
    { key_hash: keyHash, revoked: { $ne: true } },
  );
  if (!apiKey) return null;

  const user = await db.collection('users').findOne({ _id: apiKey.user_id });
  if (!user) return null;

  // Fire-and-forget usage bump; do not block the request on it.
  db.collection('api_keys').updateOne(
    { _id: apiKey._id },
    { $set: { last_used_at: new Date() } },
  ).catch(() => {});

  return user;
}

function publicUserShape(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    plan: user.plan || 'free',
    plan_expires_at: user.plan_expires_at || null,
    notifications: user.notifications || null,
    created_at: user.created_at || null,
  };
}

/** Strict user auth — rejects 401 if no valid user token. */
export async function requireUser(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(Errors.Unauthorized('Authentication required'));
  }
  const token = header.slice(7);

  try {
    const db = getDb();
    let user = null;

    if (!token.startsWith(API_KEY_PREFIX)) {
      user = await resolveUserSession(db, token);
    } else {
      user = await resolveApiKey(db, token);
    }

    if (!user) {
      return next(Errors.Unauthorized('Invalid or expired session'));
    }

    req.user = publicUserShape(user);
    req.authMethod = token.startsWith(API_KEY_PREFIX) ? 'api_key' : 'session';
    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth — attaches req.user when a valid token/key is present, else req.user = null and continues. */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    req.authMethod = 'anonymous';
    return next();
  }
  const token = header.slice(7);

  try {
    const db = getDb();
    let user = null;
    if (token.startsWith(API_KEY_PREFIX)) {
      user = await resolveApiKey(db, token);
    } else {
      user = await resolveUserSession(db, token);
    }
    req.user = user ? publicUserShape(user) : null;
    req.authMethod = user ? (token.startsWith(API_KEY_PREFIX) ? 'api_key' : 'session') : 'anonymous';
    next();
  } catch (err) {
    // Never block an anonymous-capable request on auth errors; just de-attribute.
    req.user = null;
    req.authMethod = 'anonymous';
    next();
  }
}
