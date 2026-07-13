/**
 * Snapchat URL detection utilities.
 */

export function isSnapchatUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('snapchat.com')) return true;
        return false;
    } catch {
        return false;
    }
}
