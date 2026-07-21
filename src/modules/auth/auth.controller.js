import crypto from 'node:crypto';
import { getDb, ObjectId } from '../../db/index.js';
import { hashPassword, verifyPassword } from '../../db/seed.js';
import { config } from '../../config/index.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';

function generateToken() {
  return crypto.randomUUID();
}

function sessionTtl() {
  return config.userSessionTtlHours * 60 * 60 * 1000;
}

function defaultNotifications() {
  return {
    email_completed: true,
    weekly_summary: true,
    product_updates: false,
    billing_reminders: true,
  };
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
    notifications: user.notifications || defaultNotifications(),
    created_at: user.created_at || null,
  };
}

async function issueSession(db, user) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + sessionTtl());
  await db.collection('user_sessions').insertOne({
    id: token,
    user_id: user._id,
    expires_at: expiresAt,
    created_at: new Date(),
  });
  return { token, expiresAt };
}

export const register = wrapAsync(async (req, res) => {
  const { first_name, last_name, email, password } = req.validated;
  const db = getDb();

  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) throw Errors.Conflict('An account with that email already exists');

  const now = new Date();
  const name = `${first_name} ${last_name}`.trim();
  const insert = await db.collection('users').insertOne({
    email: email.toLowerCase(),
    password_hash: hashPassword(password),
    name,
    first_name,
    last_name,
    plan: 'free',
    plan_expires_at: null,
    stripe_customer_id: null,
    notifications: defaultNotifications(),
    created_at: now,
    updated_at: now,
  });

  const user = await db.collection('users').findOne({ _id: insert.insertedId });
  const { token, expiresAt } = await issueSession(db, user);

  res.status(201).json({
    success: true,
    data: {
      token,
      expires_at: expiresAt,
      user: publicUserShape(user),
    },
  });
});

export const login = wrapAsync(async (req, res) => {
  const { email, password } = req.validated;
  const db = getDb();

  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) throw Errors.Unauthorized('Invalid email or password');
  if (!verifyPassword(password, user.password_hash)) {
    throw Errors.Unauthorized('Invalid email or password');
  }

  const { token, expiresAt } = await issueSession(db, user);

  res.json({
    success: true,
    data: {
      token,
      expires_at: expiresAt,
      user: publicUserShape(user),
    },
  });
});

export const logout = wrapAsync(async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    await getDb().collection('user_sessions').deleteOne({ id: token });
  }
  res.json({ success: true, data: { message: 'Logged out' } });
});

export const getMe = wrapAsync(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

export const changePassword = wrapAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.validated;
  const db = getDb();

  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  if (!user) throw Errors.Unauthorized('Authentication required');
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw Errors.BadRequest('Current password is incorrect');
  }

  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { password_hash: hashPassword(newPassword), updated_at: new Date() } },
  );

  // Invalidate all other sessions for this user (keep the current one).
  const currentToken = req.headers.authorization?.slice(7);
  await db.collection('user_sessions').deleteMany({
    user_id: user._id,
    ...(currentToken ? { id: { $ne: currentToken } } : {}),
  });

  res.json({ success: true, data: { message: 'Password changed' } });
});
