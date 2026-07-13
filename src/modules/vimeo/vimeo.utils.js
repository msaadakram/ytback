/**
 * Vimeo URL detection utilities.
 */

export function isVimeoUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('vimeo.com')) return true;
        return false;
    } catch {
        return false;
    }
}
