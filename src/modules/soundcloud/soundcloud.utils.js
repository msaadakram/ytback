/**
 * SoundCloud URL detection utilities.
 */

export function isSoundCloudUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('soundcloud.com')) return true;
        return false;
    } catch {
        return false;
    }
}
