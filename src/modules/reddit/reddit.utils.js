/**
 * Reddit URL detection utilities.
 */

export function isRedditUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('reddit.com') || host.endsWith('redd.it')) return true;
        return false;
    } catch {
        return false;
    }
}
