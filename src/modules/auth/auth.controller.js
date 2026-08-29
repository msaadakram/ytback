import crypto from 'node:crypto';
import { getDb, ObjectId } from '../../db/index.js';
import { hashPassword, verifyPassword } from '../../db/seed.js';
import { config } from '../../config/index.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors, HttpError } from '../../utils/HttpError.js';
import {
  generateSixDigitCode,
  hashCode,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../../utils/mailer.js';
import logger from '../../utils/logger.js';

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
    // Users created before email verification shipped have no flag — treat
    // them as verified so legacy accounts are never locked out.
    email_verified: user.email_verified !== false,
    has_password: Boolean(user.password_hash),
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

// ─── Verification / reset code helpers ────────────────────────────────────────

let indexesReady = null;

/** Create the auth_codes indexes once per process. */
function ensureCodeIndexes(db) {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = db.collection('auth_codes');
      await col.createIndex({ email: 1, purpose: 1 }, { unique: true });
      await col.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    })().catch((err) => {
      indexesReady = null;
      logger.error({ err: err.message }, 'failed to create auth_codes indexes');
    });
  }
  return indexesReady;
}

/**
 * Generate a 6-digit code for (email, purpose), store it hashed with an expiry,
 * and email it. Enforces a resend cooldown. Throws TooMany when resending too
 * fast. Returns { delivered, id?, reason?, error? }.
 *
 * Critical fix: the code is now generated first, then the mail is attempted,
 * and the DB is updated AFTER the mail result. On provider failure we store
 * the code WITHOUT advancing last_sent_at so the user can retry immediately
 * instead of being locked out for 60s with no email.
 */
async function issueCode(db, email, purpose, ttlMinutes, mailer) {
  await ensureCodeIndexes(db);
  const col = db.collection('auth_codes');
  const now = new Date();

  const existing = await col.findOne({ email, purpose });
  if (existing?.last_sent_at) {
    const last = existing.last_sent_at instanceof Date ? existing.last_sent_at : new Date(existing.last_sent_at);
    const elapsed = (now.getTime() - last.getTime()) / 1000;
    if (elapsed < config.emailCodeResendSeconds) {
      const retryIn = Math.ceil(config.emailCodeResendSeconds - elapsed);
      throw Errors.TooMany(`Please wait ${retryIn}s before requesting another code`);
    }
  }

  const code = generateSixDigitCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  let delivered = false;
  let deliveredId = null;
  let isDevNoKey = false;
  let mailError = null;

  try {
    const result = await mailer(email, code);
    delivered = !!result.delivered;
    deliveredId = result.id || null;
    isDevNoKey = result.reason === 'missing_api_key';
    if (isDevNoKey) {
      // Dev fallback: code is logged by mailer, also log here for visibility
      logger.warn({ email, purpose, code }, '[DEV MAIL] code generated (no provider)');
    }
  } catch (err) {
    mailError = err;
    logger.error({ err: err.message, email, purpose }, 'failed to send code email');
    // Store the code but do NOT advance last_sent_at so immediate retry is allowed.
    // This fixes the bug where a provider failure locked the user out for 60s.
    try {
      await col.updateOne(
        { email, purpose },
        {
          $set: { code_hash: codeHash, expires_at: expiresAt, attempts: 0 },
          $setOnInsert: { created_at: now },
        },
        { upsert: true },
      );
      // For brand-new docs that never had last_sent_at, ensure it stays absent
      // so the next attempt bypasses the cooldown check.
    } catch (dbErr) {
      logger.error({ err: dbErr.message, email, purpose }, 'failed to store code after mail failure');
    }
    return { delivered: false, error: err.message };
  }

  // Mail succeeded, or dev fallback (missing key) — store with last_sent_at to enforce cooldown
  try {
    await col.updateOne(
      { email, purpose },
      {
        $set: { code_hash: codeHash, expires_at: expiresAt, attempts: 0, last_sent_at: now },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );
  } catch (dbErr) {
    logger.error({ err: dbErr.message, email, purpose }, 'failed to store code after mail success');
  }

  return { delivered, id: deliveredId, dev: isDevNoKey };
}

/**
 * Verify a submitted code for (email, purpose). Deletes the code on success,
 * increments attempt counter on failure. Throws when invalid/expired/exhausted.
 */
async function consumeCode(db, email, purpose, code) {
  const col = db.collection('auth_codes');
  const doc = await col.findOne({ email, purpose });
  if (!doc) throw Errors.BadRequest('Invalid or expired code. Please request a new one.');
  if (doc.expires_at < new Date()) {
    await col.deleteOne({ _id: doc._id });
    throw Errors.BadRequest('Code expired. Please request a new one.');
  }
  if (doc.attempts >= config.emailCodeMaxAttempts) {
    await col.deleteOne({ _id: doc._id });
    throw Errors.BadRequest('Too many incorrect attempts. Please request a new code.');
  }
  if (doc.code_hash !== hashCode(code)) {
    await col.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    throw Errors.BadRequest('Invalid code. Please check your email and try again.');
  }
  await col.deleteOne({ _id: doc._id });
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
    email_verified: false,
    created_at: now,
    updated_at: now,
  });

  const user = await db.collection('users').findOne({ _id: insert.insertedId });
  const { token, expiresAt } = await issueSession(db, user);

  // Send the 6-digit verification code to the freshly registered address.
  const verification = await issueCode(
    db,
    user.email,
    'verify_email',
    config.emailCodeTtlMinutes,
    sendVerificationEmail,
  );

  res.status(201).json({
    success: true,
    data: {
      token,
      expires_at: expiresAt,
      verification_required: true,
      email_delivered: verification.delivered,
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

  // Only email/password signups go through verification; legacy accounts
  // (no flag) and Google accounts are never blocked.
  if (user.email_verified === false) {
    throw new HttpError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email address before signing in. Check your inbox for the 6-digit code.',
    );
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

export const verifyEmail = wrapAsync(async (req, res) => {
  const { email, code } = req.validated;
  const db = getDb();

  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) throw Errors.NotFound('No account found with that email');

  if (user.email_verified !== false) {
    res.json({ success: true, data: { message: 'Email already verified' } });
    return;
  }

  await consumeCode(db, user.email, 'verify_email', code);
  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { email_verified: true, updated_at: new Date() } },
  );

  res.json({ success: true, data: { message: 'Email verified successfully' } });
});

export const resendVerification = wrapAsync(async (req, res) => {
  const { email } = req.validated;
  const db = getDb();

  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  // Respond identically whether or not the account exists / is verified, so
  // the endpoint can't be used to enumerate registered emails.
  if (user && user.email_verified === false) {
    await issueCode(db, user.email, 'verify_email', config.emailCodeTtlMinutes, sendVerificationEmail);
  }

  res.json({
    success: true,
    data: { message: 'If that email needs verification, a new code has been sent.' },
  });
});

export const forgotPassword = wrapAsync(async (req, res) => {
  const { email } = req.validated;
  const db = getDb();

  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  // Same anti-enumeration policy as resendVerification.
  if (user && user.password_hash) {
    await issueCode(
      db,
      user.email,
      'reset_password',
      config.passwordResetTtlMinutes,
      sendPasswordResetEmail,
    );
  }

  res.json({
    success: true,
    data: { message: 'If an account exists for that email, a reset code has been sent.' },
  });
});

export const resetPassword = wrapAsync(async (req, res) => {
  const { email, code, newPassword } = req.validated;
  const db = getDb();

  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user || !user.password_hash) {
    throw Errors.BadRequest('Invalid or expired code. Please request a new one.');
  }

  await consumeCode(db, user.email, 'reset_password', code);

  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { password_hash: hashPassword(newPassword), email_verified: true, updated_at: new Date() } },
  );

  // Password changed — kill every existing session for this user.
  await db.collection('user_sessions').deleteMany({ user_id: user._id });

  res.json({ success: true, data: { message: 'Password reset successfully. You can now sign in.' } });
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
