import { z } from 'zod';

/**
 * bcrypt only considers the first 72 bytes of a password, so anything longer is
 * rejected rather than silently truncated.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Keep it under 72 characters.')
  .regex(/[A-Za-z]/, 'Add at least one letter.')
  .regex(/[0-9]/, 'Add at least one number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('That does not look like an email address.')
  .max(254);

/**
 * Note the absence of a `role` field: signup always creates a CANDIDATE. HR
 * accounts are provisioned by the seed script only, so no request body can
 * escalate its own privileges.
 */
export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Your name needs at least 2 characters.').max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately lax: login validates credentials, not password strength.
  password: z.string().min(1, 'Enter your password.').max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
