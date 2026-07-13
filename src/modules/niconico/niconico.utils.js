/**
 * Niconico URL detection utilities.
 */

export function isNiconicoUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('nicovideo.jp')) return true;
        return false;
    } catch {
        return false;
    }
}
