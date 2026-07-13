/**
 * Kick URL detection utilities.
 */

export function isKickUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('kick.com')) return true;
        return false;
    } catch {
        return false;
    }
}
