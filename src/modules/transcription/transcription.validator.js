import { z } from 'zod';
import { isLikelyUrl } from '../../utils/platformDetector.js';

const urlField = z
    .string({ required_error: 'url is required' })
    .trim()
    .min(1, 'url is required')
    .refine(isLikelyUrl, { message: 'Must be a valid URL' });

export const transcriptionSchema = z.object({
    url: urlField,
    format: z
        .enum(['txt', 'srt', 'json'])
        .default('txt'),
});
