import { supportedVideoQualities } from '../core/download.js';
import { supportedAudioFormats } from '../core/download.js';

const startedAt = Date.now();

export function health(_req, res) {
  res.json({
    success: true,
    data: { status: 'ok', uptime: Math.floor((Date.now() - startedAt) / 1000) },
  });
}

export function getCapabilities(_req, res) {
  res.json({
    success: true,
    data: {
      supportedPlatforms: [
        'youtube', 'tiktok', 'instagram', 'facebook', 'vimeo', 'twitch', 'dailymotion', 'reddit', 'soundcloud',
        'kick', 'snapchat', 'linkedin', 'pinterest', 'niconico'
      ],
      videoQualities: supportedVideoQualities(),
      videoContainers: ['mp4', 'mkv', 'webm'],
      audioFormats: supportedAudioFormats(),
      audioQualities: ['128', '192', '256', '320'],
    },
  });
}
