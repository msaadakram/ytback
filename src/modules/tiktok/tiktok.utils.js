/**
 * TikTok URL detection utilities.
 */

export function isTikTokUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        // covers www.tiktok.com, vm.tiktok.com, vt.tiktok.com
        if (host.endsWith('tiktok.com')) return true;
        return false;
    } catch {
        return false;
    }
}
