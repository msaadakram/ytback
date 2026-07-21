import { z } from 'zod';

/** Manual fallback plan toggle (used when Stripe is not configured). */
export const setPlanSchema = z.object({
  plan: z.enum(['free', 'pro']),
});
