/**
 * Instagram URL detection utilities.
 */

export function isInstagramUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('instagram.com')) return true;
        return false;
    } catch {
        return false;
    }
}
