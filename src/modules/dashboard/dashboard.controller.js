import { getDb, ObjectId } from '../../db/index.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  // Week starts on Monday.
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0 ... Sun=6
  x.setDate(x.getDate() - dow);
  return x;
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatBucketLabel(date, mode) {
  if (mode === 'week') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * GET /api/dashboard/overview
 * Aggregated stat cards + trend deltas for the Overview tab.
 */
export const getOverview = wrapAsync(async (req, res) => {
  const db = getDb();
  const uid = new ObjectId(req.user.id);

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - DAY);
  const last7Start = new Date(todayStart.getTime() - 6 * DAY);
  const prev7Start = new Date(todayStart.getTime() - 13 * DAY);
  const last30Start = new Date(todayStart.getTime() - 29 * DAY);

  const [
    totalDownloads,
    last7Downloads,
    prev7Downloads,
    callsToday,
    callsYesterday,
    last7Calls,
    prev7Calls,
    platformsAgg,
    successAgg,
  ] = await Promise.all([
    db.collection('downloads').countDocuments({ user_id: uid }),
    db.collection('downloads').countDocuments({ user_id: uid, created_at: { $gte: last7Start } }),
    db.collection('downloads').countDocuments({ user_id: uid, created_at: { $gte: prev7Start, $lt: last7Start } }),
    db.collection('usage_events').countDocuments({ user_id: uid, created_at: { $gte: todayStart } }),
    db.collection('usage_events').countDocuments({ user_id: uid, created_at: { $gte: yesterdayStart, $lt: todayStart } }),
    db.collection('usage_events').countDocuments({ user_id: uid, created_at: { $gte: last7Start } }),
    db.collection('usage_events').countDocuments({ user_id: uid, created_at: { $gte: prev7Start, $lt: last7Start } }),
    db.collection('downloads').distinct('platform', { user_id: uid, created_at: { $gte: last30Start } }),
    db.collection('usage_events').aggregate([
      { $match: { user_id: uid, created_at: { $gte: last7Start } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const platformsUsed = platformsAgg.length;
  const totalCalls7 = last7Calls;
  const success7 = successAgg.find((s) => s._id === 'success')?.count || 0;
  const successRate = totalCalls7 ? (success7 / totalCalls7) * 100 : 0;

  res.json({
    success: true,
    data: {
      totalDownloads,
      apiCallsToday: callsToday,
      platformsUsed,
      successRate: Number(successRate.toFixed(1)),
      trends: {
        downloads: Number(pctChange(last7Downloads, prev7Downloads).toFixed(1)),
        apiCalls: Number(pctChange(callsToday, callsYesterday || 0).toFixed(1)),
        platforms: platformsUsed, // no meaningful delta; mirror count
        successRate: 0, // kept neutral; success-rate delta rarely meaningful
      },
    },
  });
});

/**
 * GET /api/dashboard/timeseries?range=7w|4w|12w
 * Weekly buckets of usage calls + errors for the area chart.
 */
export const getTimeseries = wrapAsync(async (req, res) => {
  const db = getDb();
  const uid = new ObjectId(req.user.id);

  const weeks = Math.min(Math.max(parseInt(req.query.range, 10) || 7, 1), 26);
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const earliest = new Date(thisWeekStart.getTime() - (weeks - 1) * 7 * DAY);

  const rows = await db.collection('usage_events').aggregate([
    {
      $match: {
        user_id: uid,
        created_at: { $gte: earliest },
      },
    },
    {
      $group: {
        _id: {
          weekStart: {
            $dateFromParts: {
              isoWeekYear: { $isoWeekYear: '$created_at' },
              isoWeek: { $isoWeek: '$created_at' },
              isoDayOfWeek: 1,
            },
          },
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  // Build contiguous weekly buckets so the chart always shows N weeks even with gaps.
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeekStart.getTime() - i * 7 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    const calls = rows
      .filter((r) => {
        const ws = r._id.weekStart;
        return ws && ws.getTime() >= start.getTime() && ws.getTime() < end.getTime();
      })
      .reduce((sum, r) => sum + r.count, 0);
    const errors = rows
      .filter((r) => {
        const ws = r._id.weekStart;
        return ws && ws.getTime() >= start.getTime() && ws.getTime() < end.getTime() && r._id.status === 'error';
      })
      .reduce((sum, r) => sum + r.count, 0);
    buckets.push({
      bucket: formatBucketLabel(start, 'week'),
      calls,
      errors,
    });
  }

  res.json({ success: true, data: { buckets } });
});

/**
 * GET /api/dashboard/recent-downloads?limit=5
 * Most recent downloads for the Overview table.
 */
export const getRecentDownloads = wrapAsync(async (req, res) => {
  const db = getDb();
  const uid = new ObjectId(req.user.id);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);

  const items = await db.collection('downloads')
    .find({ user_id: uid })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();

  res.json({ success: true, data: { recent: items.map(formatDownloadRow) } });
});

/**
 * GET /api/dashboard/downloads?search=&page=&limit=
 * Paginated history table + current-week daily buckets for the bar chart.
 */
export const getDownloadsHistory = wrapAsync(async (req, res) => {
  const db = getDb();
  const uid = new ObjectId(req.user.id);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const search = (req.query.search || '').toString().trim();

  const query = { user_id: uid };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { filename: { $regex: search, $options: 'i' } },
      { platform: { $regex: search, $options: 'i' } },
      { source_url: { $regex: search, $options: 'i' } },
    ];
  }

  const [total, items] = await Promise.all([
    db.collection('downloads').countDocuments(query),
    db.collection('downloads')
      .find(query)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
  ]);

  // Current week (Mon–Sun) daily download counts for the bar chart.
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  const weekAgg = await db.collection('downloads').aggregate([
    { $match: { user_id: uid, created_at: { $gte: weekStart, $lt: weekEnd } } },
    { $group: { _id: { $dayOfWeek: '$created_at' }, count: { $sum: 1 } } },
  ]).toArray();
  // Mongo $dayOfWeek: 1=Sunday..7=Saturday. Convert to Mon-first labels.
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekly = dayNames.map((day, idx) => {
    const dow = ((idx + 1) % 7) + 1; // Mon->2, ..., Sun->1
    const row = weekAgg.find((r) => r._id === dow);
    return { day, downloads: row?.count || 0 };
  });

  res.json({
    success: true,
    data: {
      items: items.map(formatDownloadRow),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      weekly,
    },
  });
});

function formatDownloadRow(row) {
  const ext = row.filename ? row.filename.split('.').pop() : null;
  return {
    id: row._id.toString(),
    title: row.title || row.filename || 'Untitled',
    filename: row.filename || null,
    platform: row.platform,
    type: row.type,
    ext: ext || null,
    format_label: row.format_label || null,
    size: row.size || 0,
    status: row.status,
    error: row.error || null,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

export { Errors };
