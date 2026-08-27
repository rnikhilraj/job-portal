import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { clientKey, enforceRateLimit } from '@/lib/rate-limit';
import { loginSchema } from '@/modules/auth/auth.schema';
import { authenticate } from '@/modules/auth/auth.service';
import { attachSessionCookie } from '@/modules/auth/session';

/** POST /api/auth/login — issues the session cookie for HR and candidates alike. */
export const POST = withRoute(async (request) => {
  enforceRateLimit(clientKey(request, 'login'), { limit: 10, windowMs: 15 * 60 * 1000 });

  const input = loginSchema.parse(await request.json());
  const { user, session } = await authenticate(input);

  return attachSessionCookie(ok(user), session);
});
