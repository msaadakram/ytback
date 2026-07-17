/**
 * Consolidated URL-to-platform detection.
 * Centralises all the is*Url functions from individual platform modules.
 */

const detectors = [
  { platform: 'youtube',     test: (h) => h === 'youtu.be' || h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com') },
  { platform: 'tiktok',      test: (h) => h.endsWith('tiktok.com') },
  { platform: 'instagram',   test: (h) => h.endsWith('instagram.com') },
  { platform: 'facebook',    test: (h) => h.endsWith('facebook.com') || h.endsWith('fb.watch') },
  { platform: 'vimeo',       test: (h) => h.endsWith('vimeo.com') },
  { platform: 'twitch',      test: (h) => h.endsWith('twitch.tv') },
  { platform: 'dailymotion', test: (h) => h.endsWith('dailymotion.com') || h.endsWith('dai.ly') },
  { platform: 'reddit',      test: (h) => h.endsWith('reddit.com') || h.endsWith('redd.it') },
  { platform: 'soundcloud',  test: (h) => h.endsWith('soundcloud.com') || h.endsWith('on.soundcloud.com') },
  { platform: 'kick',        test: (h) => h.endsWith('kick.com') },
  { platform: 'snapchat',    test: (h) => h.endsWith('snapchat.com') },
  { platform: 'linkedin',    test: (h) => h.endsWith('linkedin.com') },
  { platform: 'pinterest',   test: (h) => h.endsWith('pinterest.com') || h.endsWith('pin.it') },
  { platform: 'niconico',    test: (h) => h.endsWith('nicovideo.jp') || h.endsWith('niconico.jp') },
];

const CACHE = new Map();

/**
 * Detect the platform for a given URL.
 * @param {string} url
 * @returns {{ platform: string, hostname: string } | null}
 */
export function detectPlatform(url) {
  if (CACHE.has(url)) return CACHE.get(url);

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    for (const d of detectors) {
      if (d.test(host)) {
        const result = { platform: d.platform, hostname: host };
        CACHE.set(url, result);
        return result;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Simple hostname-based check (no URL parsing needed for quick checks). */
export function isLikelyUrl(str) {
  if (typeof str !== 'string') return false;
  try {
    new URL(str);
    return true;
  } catch {
    return str.startsWith('http://') || str.startsWith('https://');
  }
}

export function clearCache() {
  CACHE.clear();
}
