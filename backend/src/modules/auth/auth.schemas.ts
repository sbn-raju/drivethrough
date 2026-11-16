import { z } from 'zod';
import { emailSchema, identifierSchema, phoneSchema } from '../../common/utils/contact.js';

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use 128 characters or fewer.')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.');

const otpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.');

/** Role selection at registration can never grant admin privileges. */
export const registerSchema = z
  .object({
    role: z.enum(['consumer', 'driver']),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
  })
  .refine((v) => v.email || v.phone, { message: 'Enter an email address or mobile number.', path: ['email'] });

export const verifyOtpSchema = z.object({
  identifier: identifierSchema,
  code: otpCode,
});

export const resendOtpSchema = z.object({
  identifier: identifierSchema,
  purpose: z.enum(['signup', 'password_reset']).default('signup'),
});

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const forgotPasswordSchema = z.object({ identifier: identifierSchema });

export const resetPasswordSchema = z.object({
  identifier: identifierSchema,
  code: otpCode,
  newPassword: passwordSchema,
});
