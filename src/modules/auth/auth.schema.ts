import { z } from 'zod';

/**
 * bcrypt only considers the first 72 bytes of a password, so anything longer is
 * rejected rather than silently truncated.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254);

/**
 * Note the absence of a `role` field: signup always creates a CANDIDATE. HR
 * accounts are provisioned by the seed script only, so no request body can
 * escalate its own privileges.
 */
export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately lax: login validates credentials, not password strength.
  password: z.string().min(1, 'Password is required.').max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
