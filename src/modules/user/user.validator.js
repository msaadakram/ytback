import { z } from 'zod';

export const updateProfileSchema = z.object({
  first_name: z.string().trim().min(1).max(60).optional(),
  last_name: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().email('A valid email is required').optional(),
});

export const updateNotificationsSchema = z.object({
  email_completed: z.boolean().optional(),
  weekly_summary: z.boolean().optional(),
  product_updates: z.boolean().optional(),
  billing_reminders: z.boolean().optional(),
});
