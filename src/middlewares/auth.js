import { getDb } from '../db/index.js';
import { Errors } from '../utils/HttpError.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(Errors.Unauthorized('Authentication required'));
  }

  const token = header.slice(7);
  const db = getDb();
  const session = db.prepare(`
    SELECT s.id, s.admin_id, a.email, a.name
    FROM sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!session) {
    return next(Errors.Unauthorized('Invalid or expired session'));
  }

  req.admin = session;
  next();
}
