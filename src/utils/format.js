import path from 'node:path';
import crypto from 'node:crypto';

const BAD_CHARS = /[^a-zA-Z0-9._-]/g;

export function sanitizeFilename(name, fallback = 'video') {
  const base = path.basename(name || fallback);
  const cleaned = base.replace(BAD_CHARS, '_').replace(/_+/g, '_').slice(0, 180);
  return cleaned || fallback;
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)}${units[i]}`;
}

export function formatDuration(sec) {
  if (!sec || sec < 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function randomToken(len = 6) {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

export function safeFilenameForId(title, ext, jobId) {
  const slug = sanitizeFilename(title, `yt-${jobId.slice(0, 8)}`).slice(0, 80);
  return `${slug}_${jobId.slice(0, 8)}.${ext}`;
}
