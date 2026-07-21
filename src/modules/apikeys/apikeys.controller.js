import { getDb, ObjectId } from '../../db/index.js';
import { generateApiKey, hashApiKey, API_KEY_PREFIX } from '../../middlewares/userAuth.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';

function maskKey(prefix) {
  // `prefix` is the first 12 chars of the real key (e.g. df_live_abc12...).
  return `${prefix}${'•'.repeat(20)}`;
}

function publicApiKeyShape(key) {
  return {
    id: key._id.toString(),
    name: key.name,
    key_prefix: key.key_prefix,
    masked: maskKey(key.key_prefix),
    last_used_at: key.last_used_at || null,
    created_at: key.created_at || null,
    revoked: key.revoked === true,
  };
}

export const listKeys = wrapAsync(async (req, res) => {
  const db = getDb();
  const keys = await db.collection('api_keys')
    .find({ user_id: new ObjectId(req.user.id), revoked: { $ne: true } })
    .sort({ created_at: -1 })
    .toArray();
  res.json({ success: true, data: { keys: keys.map(publicApiKeyShape) } });
});

export const createKey = wrapAsync(async (req, res) => {
  const { name } = req.validated;
  const db = getDb();

  const plaintext = generateApiKey();
  const key_prefix = plaintext.slice(0, 12); // "df_live_" + first 4 hex chars
  const now = new Date();

  const insert = await db.collection('api_keys').insertOne({
    user_id: new ObjectId(req.user.id),
    name,
    key_hash: hashApiKey(plaintext),
    key_prefix,
    last_used_at: null,
    created_at: now,
    revoked: false,
  });

  const key = await db.collection('api_keys').findOne({ _id: insert.insertedId });

  res.status(201).json({
    success: true,
    data: {
      key: publicApiKeyShape(key),
      // Plaintext is returned exactly once — the client must store it.
      plaintext,
    },
  });
});

export const deleteKey = wrapAsync(async (req, res) => {
  const db = getDb();
  const result = await db.collection('api_keys').updateOne(
    {
      _id: new ObjectId(req.params.id),
      user_id: new ObjectId(req.user.id),
    },
    { $set: { revoked: true } },
  );
  if (result.matchedCount === 0) throw Errors.NotFound('API key not found');
  res.json({ success: true, data: { message: 'API key revoked' } });
});

export { API_KEY_PREFIX };
