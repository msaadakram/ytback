/**
 * Dailymotion URL detection utilities.
 */

export function isDailymotionUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('dailymotion.com') || host.endsWith('dai.ly')) return true;
        return false;
    } catch {
        return false;
    }
}
