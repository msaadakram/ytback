/**
 * Facebook URL detection utilities.
 */

export function isFacebookUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('facebook.com') || host.endsWith('fb.watch')) return true;
        return false;
    } catch {
        return false;
    }
}
