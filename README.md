# ytback

Production-ready Node.js REST backend that wraps **yt-dlp** and **ffmpeg**. Accepts YouTube, TikTok, Instagram, Facebook, Vimeo, Twitch, Dailymotion, Reddit, SoundCloud, Bilibili, Kick, Snapchat, LinkedIn, Pinterest, or Niconico URLs. Returns full metadata + format lists, downloads video/audio through a bounded concurrency queue, streams live progress, and serves the resulting files with HTTP Range support.

No frontend. REST only. Supports **YouTube**, **TikTok**, **Instagram**, **Facebook**, **Vimeo**, **Twitch**, **Dailymotion**, **Reddit**, **SoundCloud**, **Bilibili**, **Kick**, **Snapchat**, **LinkedIn**, **Pinterest**, and **Niconico**.

---

## Requirements

- Node.js >= 20 LTS (tested on 24.x)
- `yt-dlp` on PATH (or set `YTDLP_BIN`)
- `ffmpeg` + `ffprobe` on PATH (or set `FFMPEG_BIN`)

```bash
yt-dlp --version
ffmpeg -version | head -1
```

## Installation

```bash
cd ytback
npm install
cp .env.example .env   # then edit if needed
```

## Running

```bash
npm start            # production
npm run dev          # auto-restart on file changes (node --watch)
```

Server listens on `http://localhost:4000` by default.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` to hide stack traces |
| `LOG_LEVEL` | `info` | pino log level (`trace`…`fatal`) |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS allow-list. Empty = allow all |
| `DOWNLOAD_DIR` | `downloads` | Final files served via `/download/:filename` |
| `TEMP_DIR` | `temp` | Working dir for yt-dlp during download/merge |
| `MAX_FILE_SIZE` | `10737418240` | Reject outputs larger than this (10 GiB) |
| `MAX_DOWNLOAD_TIME` | `1800` | Per-download timeout in seconds |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | Queue concurrency |
| `AUTO_DELETE_MINUTES` | `60` | Job + file TTL |
| `YTDLP_BIN` | `yt-dlp` | Path to yt-dlp binary |
| `FFMPEG_BIN` | `ffmpeg` | Path to ffmpeg binary |

## API

All responses use `{ success, data }` on success or `{ success: false, error: { code, message } }` on error.

### Shared Endpoints

#### `GET /api/health`
```json
{ "success": true, "data": { "status": "ok", "uptime": 123 } }
```

#### `GET /api/capabilities`
Returns supported platforms, quality labels, containers, and audio formats/qualities.
```json
{ "success": true, "data": {
  "supportedPlatforms": [
    "youtube", "tiktok", "instagram", "facebook", "vimeo", "twitch", "dailymotion", "reddit", "soundcloud",
    "bilibili", "kick", "snapchat", "linkedin", "pinterest", "niconico"
  ],
  "videoQualities": ["144p","240p","360p","480p","720p","1080p","1440p","2160p","4k","4320p","8k","best","worst"],
  "videoContainers": ["mp4","mkv","webm"],
  "audioFormats": ["mp3","m4a","wav","aac","opus","flac"],
  "audioQualities": ["128","192","256","320"]
}}
```

---

### YouTube Endpoints

#### `POST /api/youtube/info`
Body: `{ "url": "https://youtube.com/watch?v=..." }`
Returns title, duration, thumbnail, uploader, channel, upload date, description, view/like counts, subtitles, automatic captions, chapters, and `videoFormats` / `audioFormats` arrays.

#### `POST /api/youtube/download`
Body: `{ "url": "...", "quality": "1080p" }` or `{ "url": "...", "format_id": "137+140" }`

Choose **either** `quality` **or** `format_id` (not both):
- `quality` — a label from `GET /api/capabilities` (`144p`–`8k`, plus `best`/`worst`).
- `format_id` — exact yt-dlp format id(s) from `/api/youtube/info` (e.g. `137+140`).
- Optional `container`: `mp4` (default), `mkv`, or `webm`.

Returns `202 { jobId, platform: "youtube", status: "started" }`.

#### `POST /api/youtube/audio`
Body: `{ "url": "...", "format": "mp3", "quality": "320" }`
Supported `format`: `mp3 m4a wav aac opus flac`. Supported `quality`: `128 192 256 320` (kbps).
Returns `202 { jobId, platform: "youtube", status: "started" }`.

---

### TikTok Endpoints

#### `POST /api/tiktok/info`
Body: `{ "url": "https://www.tiktok.com/@user/video/1234567890" }`
Returns title, duration, thumbnail, uploader, description, view/like/comment/share counts, and format arrays.

#### `POST /api/tiktok/download`
Body: `{ "url": "...", "quality": "best" }` or `{ "url": "...", "format_id": "..." }`
Same options as YouTube download. Returns `202 { jobId, platform: "tiktok", status: "started" }`.

#### `POST /api/tiktok/audio`
Body: `{ "url": "...", "format": "mp3", "quality": "320" }`
Same options as YouTube audio. Returns `202 { jobId, platform: "tiktok", status: "started" }`.

---

### Instagram Endpoints

#### `POST /api/instagram/info`
Body: `{ "url": "https://www.instagram.com/reel/ABC123/" }`
Returns title, duration, thumbnail, uploader, description, view/like/comment counts, and format arrays.

#### `POST /api/instagram/download`
Body: `{ "url": "...", "quality": "best" }` or `{ "url": "...", "format_id": "..." }`
Same options as other platforms. Returns `202 { jobId, platform: "instagram", status: "started" }`.

#### `POST /api/instagram/audio`
Body: `{ "url": "...", "format": "mp3", "quality": "320" }`
Same options as other platforms. Returns `202 { jobId, platform: "instagram", status: "started" }`.

---

### Facebook Endpoints

#### `POST /api/facebook/info`
Body: `{ "url": "https://www.facebook.com/watch/?v=123456" }` or `{ "url": "https://fb.watch/xxx/" }`
Returns title, duration, thumbnail, uploader, description, view/like/comment/share counts, and format arrays.

#### `POST /api/facebook/download`
Body: `{ "url": "...", "quality": "best" }` or `{ "url": "...", "format_id": "..." }`
Same options as other platforms. Returns `202 { jobId, platform: "facebook", status: "started" }`.

#### `POST /api/facebook/audio`
Body: `{ "url": "...", "format": "mp3", "quality": "320" }`
Same options as other platforms. Returns `202 { jobId, platform: "facebook", status: "started" }`.

---

### Expanded Endpoints (Vimeo, Bilibili, Kick, Twitch, etc.)

All of the expanded platforms follow the exact same API structure. Just replace the platform name in the URL (`/api/vimeo/*`, `/api/bilibili/*`, `/api/kick/*`, `/api/niconico/*`, etc.):

#### `POST /api/<platform>/info`
Body: `{ "url": "..." }`
Returns full metadata and format arrays for the respective platform.

#### `POST /api/<platform>/download`
Body: `{ "url": "...", "quality": "best" }` or `{ "url": "...", "format_id": "..." }`
Starts a background video download. Returns `202 { jobId, platform: "<platform>", status: "started" }`.

#### `POST /api/<platform>/audio`
Body: `{ "url": "...", "format": "mp3", "quality": "320" }`
Starts a background audio-only download. Returns `202 { jobId, platform: "<platform>", status: "started" }`.

---

### Job Tracking (shared)

#### `GET /api/job/:id`
```json
{ "success": true, "data": { "platform": "youtube", "status": "downloading", "progress": 75, "speed": "8MB/s", "eta": 10, "downloaded": 120, "total": 160, ... } }
```

#### `GET /api/job/:id/result`
```json
{ "success": true, "data": { "platform": "youtube", "status": "completed", "filename": "...", "size": 7045965, "downloadUrl": "/download/...", "expiresAt": ... } }
```

#### `GET /download/:filename`
Streams the file. Supports `Range` requests (HTTP 206 partial content) for resumable downloads. Strict path-traversal guard — only the basename is accepted and must resolve inside `DOWNLOAD_DIR`.

## Architecture

```
src/
  config/              env loading, dir bootstrap
  core/                platform-agnostic services
    ytdlp.js           yt-dlp spawn, progress parsing
    download.js        download orchestration (video + audio)
    jobStore.js        in-memory job tracking
  modules/             platform feature modules
    youtube/
      youtube.utils.js       URL detection
      youtube.validator.js   Zod schemas
      youtube.controller.js  HTTP handlers
      youtube.routes.js      route definitions
    tiktok/
      tiktok.utils.js        URL detection
      tiktok.validator.js    Zod schemas
      tiktok.controller.js   HTTP handlers
      tiktok.routes.js       route definitions
    instagram/
      instagram.utils.js       URL detection
      instagram.validator.js   Zod schemas
      instagram.controller.js  HTTP handlers
      instagram.routes.js      route definitions
    facebook/
      facebook.utils.js        URL detection
      facebook.validator.js    Zod schemas
      facebook.controller.js   HTTP handlers
      facebook.routes.js       route definitions
  controllers/         shared HTTP handlers (health, job status, file serving)
  routes/              route mounting (mounts platform sub-routers)
  middlewares/         error handler, rate limiters, request timeout, validate
  utils/               logger (pino), HttpError, formatters
  queue/               p-queue bounded concurrency
  jobs/                cleanup scheduler (expired jobs, temp/dl files)
  app.js               express app (helmet, cors, compression, morgan, routes, error mw)
  server.js            http server, graceful shutdown, signal handlers, cleanup job
downloads/             served files
temp/                  yt-dlp working dir
```

### Key design choices

- **Modular architecture.** Each platform (YouTube, TikTok, Instagram, Facebook) is a self-contained module with its own URL utils, validators, controllers, and routes. Adding a new platform means adding a new module folder.
- **No shell injection.** `child_process.spawn()` is used everywhere with arg arrays; user input is never interpolated into a shell.
- **Progress is parsed from yt-dlp stdout.** The `[download] xx.x% of ~x.xxMiB at x.xxMiB/s ETA xx:xx` line is parsed into `{ progress, total, speed, eta, downloaded }` and stored on the in-memory job.
- **In-memory job store** (`Map`). Jobs carry status, progress, file path, created/completed/expires timestamps. On expiry the cleanup job deletes the file and removes the job.
- **Bounded queue.** `p-queue` caps concurrent downloads at `MAX_CONCURRENT_DOWNLOADS`; excess requests are queued and served as slots free up.
- **Streams everywhere.** File serving uses `fs.createReadStream` with byte ranges — never loads a file into RAM. Suitable for >10 GB files.
- **Path-traversal safe.** `/download/:filename` rejects anything that is not a plain basename inside `DOWNLOAD_DIR`.
- **Centralized errors.** Every failure flows through `errorHandler` into the `{ success: false, error: { code, message } }` shape. Stack traces only in non-production.
- **Graceful shutdown.** `SIGINT`/`SIGTERM` close the HTTP server, pause the queue, clear the cleanup timer, then exit. `unhandledRejection` and `uncaughtException` are logged; the latter triggers a clean shutdown.

## Cleanup

`jobs/cleanup.js` runs every 5 minutes (configurable via `config.cleanupIntervalMs`):

1. Marks jobs past `expiresAt` as expired, deletes their files, removes them from memory.
2. Drops failed jobs older than TTL.
3. Sweeps `TEMP_DIR` for files older than TTL.
4. Sweeps `DOWNLOAD_DIR` for files older than 2× TTL.

## Deployment notes

- Run behind a reverse proxy (nginx/caddy) for TLS and to enforce body-size limits.
- In production set `NODE_ENV=production` so stack traces are hidden.
- yt-dlp needs periodic updates — `yt-dlp -U` (or your package manager) on a schedule.
- For multi-instance deployments, swap the in-memory `jobStore` for Redis and the local `p-queue` for BullMQ. The core layer is the only consumer of `jobStore`, so the change is localized.
- Consider a CDN / presigned object storage for the `/download/:filename` path if egress is high.

## Security

- Helmet (CSP, HSTS, no-sniff, frame-ancestors).
- CORS allow-list via `ALLOWED_ORIGINS`.
- Rate limiters: global (60/min), info endpoint (30/min), download endpoints (20/min).
- No `exec()`; only `spawn()` with arg arrays.
- Safe filename generation; strict path-traversal guard on file serving.
- Stack traces hidden in production.
- Request body capped at 256 KB.

## Limitations

- Jobs live in process memory — a restart loses in-flight jobs (their temp files are swept on the next cleanup tick).
- No auth. Put it behind a gateway / API key in production.
- Only supported platform URLs are accepted; other platforms are rejected early at validation time before yt-dlp is spawned. Supported platforms: YouTube, TikTok, Instagram, Facebook, Vimeo, Twitch, Dailymotion, Reddit, SoundCloud, Bilibili, Kick, Snapchat, LinkedIn, Pinterest, and Niconico.
