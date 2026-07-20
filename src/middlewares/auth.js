import { getDb } from '../db/index.js';
import { Errors } from '../utils/HttpError.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(Errors.Unauthorized('Authentication required'));
  }

  const token = header.slice(7);
  const db = getDb();

  try {
    const session = await db.collection('sessions').aggregate([
      { $match: { id: token, expires_at: { $gt: new Date() } } },
      {
        $lookup: {
          from: 'admins',
          localField: 'admin_id',
          foreignField: '_id',
          as: 'admin',
        },
      },
      { $unwind: { path: '$admin', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          id: 1,
          admin_id: '$admin._id',
          email: '$admin.email',
          name: '$admin.name',
        },
      },
    ]).next();

    if (!session) {
      return next(Errors.Unauthorized('Invalid or expired session'));
    }

    req.admin = session;
    next();
  } catch (err) {
    next(err);
  }
}
