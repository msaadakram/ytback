/**
 * Twitch URL detection utilities.
 */

export function isTwitchUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host.endsWith('twitch.tv')) return true;
        return false;
    } catch {
        return false;
    }
}
