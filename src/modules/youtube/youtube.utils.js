/**
 * YouTube URL detection utilities.
 */

export function isYouTubeUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        if (host === 'youtu.be') return true;
        if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) return true;
        return false;
    } catch {
        return false;
    }
}
