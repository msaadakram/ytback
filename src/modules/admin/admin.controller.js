import crypto from 'node:crypto';
import { getDb } from '../../db/index.js';
import { verifyPassword } from '../../db/seed.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';

function generateToken() {
  return crypto.randomUUID();
}

export const login = wrapAsync(async (req, res) => {
  const { email, password } = req.validated;
  const db = getDb();

  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (!admin) throw Errors.Unauthorized('Invalid email or password');

  if (!verifyPassword(password, admin.password_hash)) {
    throw Errors.Unauthorized('Invalid email or password');
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)')
    .run(token, admin.id, expiresAt);

  res.json({
    success: true,
    data: {
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
      expiresAt,
    },
  });
});

export const logout = wrapAsync(async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(token);
  }
  res.json({ success: true, data: { message: 'Logged out' } });
});

export const getMe = wrapAsync(async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.admin.admin_id,
      email: req.admin.email,
      name: req.admin.name,
    },
  });
});

export const changePassword = wrapAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.validated;
  const db = getDb();

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.admin_id);
  if (!verifyPassword(currentPassword, admin.password_hash)) {
    throw Errors.BadRequest('Current password is incorrect');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex');
  const passwordHash = `${salt}:${hash}`;

  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, admin.id);

  // Invalidate all other sessions
  db.prepare('DELETE FROM sessions WHERE admin_id = ? AND id != ?')
    .run(admin.id, req.headers.authorization?.slice(7) || '');

  res.json({ success: true, data: { message: 'Password changed' } });
});
