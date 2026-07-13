/**
 * LinkedIn URL detection utilities.
 */

export function isLinkedinUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('linkedin.com')) return true;
        return false;
    } catch {
        return false;
    }
}
