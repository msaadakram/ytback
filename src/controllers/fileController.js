import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { Errors } from '../utils/HttpError.js';
import { wrapAsync } from '../middlewares/error.js';
import { sanitizeFilename } from '../utils/format.js';

export const downloadFile = wrapAsync(async (req, res) => {
  const rawName = req.params.filename;
  if (!rawName) throw Errors.BadRequest('filename is required');

  // Strict path-traversal guard: only basename, must resolve inside downloads dir
  const base = path.basename(rawName);
  if (!base || base !== rawName) throw Errors.BadRequest('Invalid filename');
  const fullPath = path.resolve(config.downloadDir, base);
  if (!fullPath.startsWith(config.downloadDir + path.sep) && fullPath !== config.downloadDir) {
    throw Errors.BadRequest('Invalid filename');
  }

  if (!fs.existsSync(fullPath)) throw Errors.NotFound('File not found or expired');

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) throw Errors.BadRequest('Not a file');

  const range = req.headers.range;
  const total = stat.size;
  const safeName = sanitizeFilename(base);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'no-store');

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (!m) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : total - 1;
    if (start > end || end >= total) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }
    end = Math.min(end, total - 1);
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', chunkSize);
    const stream = fs.createReadStream(fullPath, { start, end });
    stream.on('error', () => {
      if (!res.headersSent) res.sendStatus(500);
    });
    return stream.pipe(res);
  }

  res.setHeader('Content-Length', total);
  fs.createReadStream(fullPath).pipe(res);
});
