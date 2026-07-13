/**
 * Pinterest URL detection utilities.
 */

export function isPinterestUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('pinterest.com') || host.endsWith('pin.it')) return true;
        return false;
    } catch {
        return false;
    }
}
