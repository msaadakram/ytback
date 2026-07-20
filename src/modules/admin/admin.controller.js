import crypto from 'node:crypto';
import { getDb, ObjectId } from '../../db/index.js';
import { verifyPassword } from '../../db/seed.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';

function generateToken() {
  return crypto.randomUUID();
}

export const login = wrapAsync(async (req, res) => {
  const { email, password } = req.validated;
  const db = getDb();

  const admin = await db.collection('admins').findOne({ email });
  if (!admin) throw Errors.Unauthorized('Invalid email or password');

  if (!verifyPassword(password, admin.password_hash)) {
    throw Errors.Unauthorized('Invalid email or password');
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.collection('sessions').insertOne({
    id: token,
    admin_id: admin._id,
    expires_at: expiresAt,
  });

  res.json({
    success: true,
    data: {
      token,
      admin: { id: admin._id.toString(), email: admin.email, name: admin.name },
      expiresAt,
    },
  });
});

export const logout = wrapAsync(async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    await getDb().collection('sessions').deleteOne({ id: token });
  }
  res.json({ success: true, data: { message: 'Logged out' } });
});

export const getMe = wrapAsync(async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.admin.admin_id.toString(),
      email: req.admin.email,
      name: req.admin.name,
    },
  });
});

export const changePassword = wrapAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.validated;
  const db = getDb();

  const admin = await db.collection('admins').findOne({ _id: new ObjectId(req.admin.admin_id) });
  if (!verifyPassword(currentPassword, admin.password_hash)) {
    throw Errors.BadRequest('Current password is incorrect');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex');
  const passwordHash = `${salt}:${hash}`;

  await db.collection('admins').updateOne(
    { _id: admin._id },
    { $set: { password_hash: passwordHash } }
  );

  // Invalidate all other sessions
  const currentToken = req.headers.authorization?.slice(7);
  await db.collection('sessions').deleteMany({
    admin_id: admin._id,
    ...(currentToken ? { id: { $ne: currentToken } } : {}),
  });

  res.json({ success: true, data: { message: 'Password changed' } });
});
