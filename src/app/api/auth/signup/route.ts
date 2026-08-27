import { created } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { clientKey, enforceRateLimit } from '@/lib/rate-limit';
import { signupSchema } from '@/modules/auth/auth.schema';
import { registerCandidate } from '@/modules/auth/auth.service';
import { attachSessionCookie } from '@/modules/auth/session';

/** POST /api/auth/signup — public candidate registration. */
export const POST = withRoute(async (request) => {
  enforceRateLimit(clientKey(request, 'signup'), { limit: 10, windowMs: 60 * 60 * 1000 });

  const input = signupSchema.parse(await request.json());
  const { user, session } = await registerCandidate(input);

  return attachSessionCookie(created(user), session);
});
