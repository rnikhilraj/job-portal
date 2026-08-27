import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { clearSessionCookie } from '@/modules/auth/session';

/** POST /api/auth/logout — clears the session cookie. Safe to call when signed out. */
export const POST = withRoute(async () => clearSessionCookie(ok({ signedOut: true })), {
  connectDb: false,
});
