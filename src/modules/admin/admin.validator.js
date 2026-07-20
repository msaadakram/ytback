import { z } from 'zod';

const ALL_PLATFORMS = [
  'youtube', 'tiktok', 'instagram', 'facebook', 'vimeo',
  'twitch', 'dailymotion', 'reddit', 'soundcloud',
  'kick', 'snapchat', 'linkedin', 'pinterest', 'niconico',
];

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const cookieSchema = z.object({
  platform: z.enum(ALL_PLATFORMS),
  cookie_data: z.string().min(1, 'Cookie data is required'),
  notes: z.string().optional(),
});
