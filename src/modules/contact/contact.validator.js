import { z } from 'zod';

/** Footer newsletter: "Get the latest updates and platform support news." */
export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required').max(254),
  // Where the subscription came from (footer, contact page, ...) — free-form tag.
  source: z.string().trim().max(60).optional(),
});

/** Contact page: "Send us a message" form. */
export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().email('A valid email address is required').max(254),
  subject: z.string().trim().min(1, 'Subject is required').max(120),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(1000),
  // Honeypot field — must be empty for humans. Not enforced here (bots get a
  // silent success in the controller instead of a validation error).
  website: z.string().max(200).optional(),
});

export default { newsletterSubscribeSchema, contactMessageSchema };
