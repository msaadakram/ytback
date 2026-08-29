import { getDb } from '../../db/index.js';
import { wrapAsync } from '../../middlewares/error.js';
import logger from '../../utils/logger.js';
import {
  sendNewsletterWelcomeEmail,
  sendContactNotificationEmail,
} from '../../utils/mailer.js';

function clientMeta(req) {
  return {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null,
    user_agent: req.headers['user-agent'] || null,
  };
}

/**
 * POST /api/newsletter/subscribe
 * Public endpoint backing the footer "Get the latest updates and platform
 * support news" form. Idempotent: re-subscribing an existing (or previously
 * unsubscribed) address simply (re)activates it.
 */
export const subscribeNewsletter = wrapAsync(async (req, res) => {
  const db = getDb();
  const { email, source } = req.validated;
  const now = new Date();

  const result = await db.collection('newsletter_subscribers').updateOne(
    { email },
    {
      $set: { subscribed: true, subscribed_at: now, updated_at: now },
      $setOnInsert: { created_at: now, source: source || 'site' },
    },
    { upsert: true },
  );

  const isnew = result.upsertedCount === 1;
  logger.info({ email, source: source || 'site', new: isnew }, 'newsletter subscribe');

  // Welcome email is best-effort: never fail the request because of mail.
  if (isnew) {
    try {
      await sendNewsletterWelcomeEmail(email);
    } catch (err) {
      logger.warn({ email, err: err.message }, 'newsletter welcome email failed');
    }
  }

  res.json({ success: true, data: { subscribed: true, message: 'You are subscribed. Watch your inbox for updates!' } });
});

/**
 * POST /api/contact
 * Public endpoint backing the contact page "Send us a message" form.
 * Stores the message in MongoDB and notifies support by email (best effort).
 * Honeypot submissions (the invisible `website` field) are silently accepted
 * so bots do not learn anything, but nothing is stored.
 */
export const sendContactMessage = wrapAsync(async (req, res) => {
  const db = getDb();
  const { name, email, subject, message, website } = req.validated;

  // Honeypot tripped → pretend success, drop the submission.
  if (website && website.trim()) {
    logger.warn({ ip: clientMeta(req).ip }, 'contact honeypot triggered — message dropped');
    return res.json({ success: true, data: { message: 'Message sent!' } });
  }

  const now = new Date();
  const doc = {
    name,
    email,
    subject,
    message,
    status: 'new',
    ...clientMeta(req),
    created_at: now,
  };

  const inserted = await db.collection('contact_messages').insertOne(doc);
  logger.info({ id: inserted.insertedId.toString(), email, subject }, 'contact message stored');

  // Support notification is best-effort: never fail the request because of mail.
  try {
    await sendContactNotificationEmail({ name, email, subject, message });
  } catch (err) {
    logger.warn({ id: inserted.insertedId.toString(), err: err.message }, 'contact notification email failed');
  }

  res.status(201).json({
    success: true,
    data: { id: inserted.insertedId.toString(), message: 'Message received. We will reply within 24 hours.' },
  });
});
