import { z } from 'zod';
import { isYouTubeUrl } from './youtube.utils.js';
import { VIDEO_QUALITIES, VIDEO_CONTAINERS } from '../../core/download.js';

const urlField = z
    .string({ required_error: 'url is required' })
    .trim()
    .min(1, 'url is required')
    .refine(isYouTubeUrl, { message: 'Only YouTube URLs are allowed' });

const qualityLabel = z
    .enum(['best', 'worst', ...Object.keys(VIDEO_QUALITIES)])
    .optional();

export const ytVideoInfoSchema = z.object({
    url: urlField,
});

export const ytVideoDownloadSchema = z
    .object({
        url: urlField,
        format_id: z.string().trim().max(120).optional(),
        quality: qualityLabel,
        container: z.enum(VIDEO_CONTAINERS).optional(),
    })
    .refine((d) => !(d.format_id && d.quality), {
        message: 'Provide either format_id OR quality, not both',
        path: ['quality'],
    })
    .transform((d) => ({ url: d.url, formatId: d.format_id, quality: d.quality, container: d.container }));

export const ytAudioDownloadSchema = z.object({
    url: urlField,
    format: z.enum(['mp3', 'm4a', 'wav', 'aac', 'opus', 'flac']).default('mp3'),
    quality: z
        .union([z.string(), z.number()])
        .transform((v) => String(v))
        .refine((v) => /^\d+$/.test(v), { message: 'quality must be a number (e.g. 320)' })
        .default('320'),
});
