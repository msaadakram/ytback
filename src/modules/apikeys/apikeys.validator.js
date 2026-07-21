import { z } from 'zod';

export const createKeySchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(60),
});
