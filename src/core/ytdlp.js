import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { Errors } from '../utils/HttpError.js';

/**
 * Inject cookie authentication args into a yt-dlp arg array.
 * Supports COOKIES_FILE (Netscape cookies.txt) or COOKIES_FROM_BROWSER (e.g. 'chrome').
 * If neither is set, falls back to cookies.txt in the project root.
 */
function injectCookieArgs(args) {
    const cookiesFile = config.cookiesFile || (fs.existsSync(config.cookiesFileDefault) ? config.cookiesFileDefault : null);
    if (cookiesFile) {
        args.unshift('--cookies', cookiesFile);
    } else if (config.cookiesFromBrowser) {
        args.unshift('--cookies-from-browser', config.cookiesFromBrowser);
    }
}

/** Pull the JSON metadata for a URL via yt-dlp --dump-json. */
export function fetchInfo(url, { timeoutMs = config.maxDownloadTime * 1000 } = {}) {
    const args = [
        '--no-warnings',
        '--no-playlist',
        '--dump-single-json',
        '--no-check-certificate',
        '--extractor-args', 'youtube:player_client=android,web',
        '--extractor-args', 'generic:impersonate',
        url,
    ];
    injectCookieArgs(args);
    return runYtdlpJson(args, { timeoutMs });
}

/**
 * Spawn yt-dlp with args, accumulate stdout JSON, parse on exit.
 * Rejects on non-zero exit or timeout.
 */
function runYtdlpJson(args, { timeoutMs }) {
    return new Promise((resolve, reject) => {
        const proc = spawn(config.ytdlpBin, args, { windowsHide: true });
        const stdoutChunks = [];
        const stderrChunks = [];
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGKILL');
        }, timeoutMs);

        proc.stdout.on('data', (d) => stdoutChunks.push(d));
        proc.stderr.on('data', (d) => stderrChunks.push(d));

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(Errors.Internal(`yt-dlp failed to start: ${err.message}`));
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            const stderr = Buffer.concat(stderrChunks).toString();
            const stdout = Buffer.concat(stdoutChunks).toString();
            if (code !== 0) {
                const msg = stderr.trim().split('\n').pop() || `yt-dlp exited with code ${code}`;
                logger.warn({ code, msg }, 'yt-dlp error');
                return reject(Errors.DownloadFailed(msg));
            }
            if (timedOut) return reject(Errors.DownloadFailed('yt-dlp timed out'));
            try {
                resolve(JSON.parse(stdout));
            } catch {
                reject(Errors.DownloadFailed('Could not parse yt-dlp JSON output'));
            }
        });
    });
}

/** Match `[download] xx.x% of ~x.xxKiB at x.xxKiB/s ETA xx:xx` lines. */
const PROGRESS_RE =
    /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+)\s*([KMGTP]?i?B)\s+at\s+([\d.]+)\s*([KMGTP]?i?B)\/s\s+ETA\s+(\d+(?::\d+)*)/i;

function parseSize(value, unit) {
    const units = { B: 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 };
    const u = unit.toUpperCase().replace(/I?B$/, '').charAt(0);
    const factor = units[u] || 1;
    return parseFloat(value) * factor;
}

function etaToSeconds(eta) {
    if (!eta) return null;
    if (eta.includes(':')) {
        const parts = eta.split(':').map(Number);
        return parts.reduce((acc, n) => acc * 60 + n, 0);
    }
    return parseInt(eta, 10);
}

export function parseProgressLine(line) {
    const m = PROGRESS_RE.exec(line);
    if (!m) return null;
    const [, percent, total, unit, speed, rateUnit, eta] = m;
    return {
        progress: parseFloat(percent),
        total: parseSize(total, unit),
        speed: `${speed}${rateUnit}/s`,
        eta: etaToSeconds(eta),
        downloaded: (parseFloat(percent) / 100) * parseSize(total, unit),
    };
}

/** Match `[download] Destination: <filename>` or `[Merger] Merging formats into "<file>"`. */
const DEST_RE = /\[(?:download|Merger|ExtractAudio|FFmpeg)\].*?["']?(?:Destination|Merging formats into|Destination|Extracting audio)[:]?\s*["']?(.+?)["']?$/i;

export function parseFilenameLine(line) {
    const m = DEST_RE.exec(line);
    return m ? m[1].trim() : null;
}

/**
 * Run a download. Calls onProgress for each progress line.
 * Resolves with { filepath } when finished.
 */
export function runDownload(args, { onProgress, onFilename, timeoutMs = config.maxDownloadTime * 1000 } = {}) {
    const hasExtractorArgs = args.includes('--extractor-args');
    if (!hasExtractorArgs) {
        args.unshift('--extractor-args', 'youtube:player_client=android,web');
        args.unshift('--extractor-args', 'generic:impersonate');
    }
    injectCookieArgs(args);
    return new Promise((resolve, reject) => {
        const proc = spawn(config.ytdlpBin, args, { windowsHide: true });
        let timedOut = false;
        let lastFilename = null;

        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGKILL');
        }, timeoutMs);

        proc.stdout.on('data', (d) => {
            const text = d.toString();
            for (const line of text.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const fn = parseFilenameLine(trimmed);
                if (fn) {
                    lastFilename = fn;
                    onFilename?.(fn);
                }
                const prog = parseProgressLine(trimmed);
                if (prog) onProgress?.(prog);
            }
        });

        proc.stderr.on('data', (d) => {
            const text = d.toString();
            // yt-dlp puts progress on stderr in some builds; try parsing too
            for (const line of text.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const prog = parseProgressLine(trimmed);
                if (prog) onProgress?.(prog);
            }
            if (/error|traceback/i.test(text)) {
                logger.warn({ stderr: text.trim() }, 'yt-dlp stderr');
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(Errors.Internal(`yt-dlp spawn error: ${err.message}`));
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) return reject(Errors.DownloadFailed('yt-dlp timed out'));
            if (code !== 0 && code !== null) {
                return reject(Errors.DownloadFailed(`yt-dlp exited with code ${code}`));
            }
            resolve({ filename: lastFilename });
        });
    });
}

export { spawn as _spawn };
