import { z } from 'zod';

/**
 * Environment contract for the server runtime.
 *
 * Validation is deliberately lazy: Next.js imports every route module during
 * `next build`, and the build stage of the Docker image has no database URI or
 * JWT secret. Parsing on first access keeps the build hermetic while still
 * failing fast at runtime — `instrumentation.ts` calls `getEnv()` during server
 * start-up, so a misconfigured deployment dies on boot rather than on the first
 * unlucky request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters to be a safe HS256 key'),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),

  UPLOADS_DIR: z.string().min(1).default('/app/uploads'),
  MAX_RESUME_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024)
    .default(5 * 1024 * 1024),

  SEED_ON_BOOT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SEED_HR_PASSWORD: z.string().min(8).default('Hr@Passw0rd123'),
  SEED_CANDIDATE_PASSWORD: z.string().min(8).default('Cand@Passw0rd123'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test-only escape hatch so suites can mutate env between cases. */
export function resetEnvCache(): void {
  cached = null;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}
