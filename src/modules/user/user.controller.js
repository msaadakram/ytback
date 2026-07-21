import { getDb, ObjectId } from '../../db/index.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';

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

export const getProfile = wrapAsync(async (req, res) => {
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  if (!user) throw Errors.NotFound('User not found');
  res.json({ success: true, data: { user: publicUserShape(user) } });
});

export const updateProfile = wrapAsync(async (req, res) => {
  const { first_name, last_name, email } = req.validated;
  const db = getDb();

  const $set = { updated_at: new Date() };
  if (first_name !== undefined) $set.first_name = first_name;
  if (last_name !== undefined) $set.last_name = last_name;
  if (email !== undefined) {
    // Ensure email stays unique.
    const clash = await db.collection('users').findOne({
      email: email.toLowerCase(),
      _id: { $ne: new ObjectId(req.user.id) },
    });
    if (clash) throw Errors.Conflict('That email is already in use');
    $set.email = email.toLowerCase();
  }
  if (first_name !== undefined || last_name !== undefined) {
    const current = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    const fn = first_name !== undefined ? first_name : (current?.first_name || '');
    const ln = last_name !== undefined ? last_name : (current?.last_name || '');
    $set.name = `${fn} ${ln}`.trim();
  }

  await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.id) },
    { $set },
  );

  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  res.json({ success: true, data: { user: publicUserShape(user) } });
});

export const updateNotifications = wrapAsync(async (req, res) => {
  const db = getDb();
  const patch = req.validated;

  const current = (await db.collection('users').findOne(
    { _id: new ObjectId(req.user.id) },
    { projection: { notifications: 1 } },
  ))?.notifications || {};

  const notifications = {
    email_completed: patch.email_completed ?? current.email_completed ?? true,
    weekly_summary: patch.weekly_summary ?? current.weekly_summary ?? true,
    product_updates: patch.product_updates ?? current.product_updates ?? false,
    billing_reminders: patch.billing_reminders ?? current.billing_reminders ?? true,
  };

  await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.id) },
    { $set: { notifications, updated_at: new Date() } },
  );

  res.json({ success: true, data: { notifications } });
});
