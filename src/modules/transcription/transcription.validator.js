import { z } from 'zod';
import { isLikelyUrl } from '../../utils/platformDetector.js';

const urlField = z
    .string({ required_error: 'url is required' })
    .trim()
    .min(1, 'url is required')
    .refine(isLikelyUrl, { message: 'Must be a valid URL' });

const LANGUAGE_CODES = [
    'auto', 'en', 'es', 'fr', 'de', 'pt', 'ja', 'ar', 'ru', 'zh',
    'hi', 'ur', 'bn', 'pa', 'ta', 'te', 'ml', 'kn', 'gu', 'mr',
    'sa', 'ne', 'si', 'my', 'th', 'vi', 'ko', 'id', 'ms', 'tl',
    'tr', 'it', 'nl', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr',
    'sr', 'sl', 'el', 'he', 'fa', 'sw', 'am', 'yo', 'ig', 'ha',
    'zu', 'af', 'sv', 'no', 'da', 'fi', 'is', 'et', 'lv', 'lt',
];

export const transcriptionSchema = z.object({
    url: urlField,
    format: z
        .enum(['txt', 'srt', 'json'])
        .default('txt'),
    language: z
        .enum(LANGUAGE_CODES)
        .default('auto'),
});
