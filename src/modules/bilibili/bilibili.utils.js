/**
 * Bilibili URL detection utilities.
 */

export function isBilibiliUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('bilibili.com') || host.endsWith('b23.tv')) return true;
        return false;
    } catch {
        return false;
    }
}
