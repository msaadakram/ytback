import { z } from 'zod';

export const registerSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(60),
  last_name: z.string().trim().min(1, 'Last name is required').max(60),
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(200),
});

const codeField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your email');

export const verifyEmailSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  code: codeField,
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  code: codeField,
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(200),
});

