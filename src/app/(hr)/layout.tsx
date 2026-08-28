import { requirePageUser } from '@/modules/auth/session';

/**
 * Role gate for the whole /hr route group.
 *
 * This lives in the layout, above every page's Suspense boundary, on purpose.
 * The pages under here have `loading.tsx` files, and a loading boundary lets
 * Next flush a 200 shell before the page component runs — which would turn the
 * redirect for a non-HR visitor into a client-side one embedded in the stream,
 * leaving the wrong HTTP status and a page that never resolves without
 * JavaScript. Redirecting from the layout keeps it a real 307.
 *
 * Pages still call requirePageUser('HR') themselves; they need the user object,
 * and a route should not depend on an ancestor for its own authorization.
 */
export default async function HrLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser('HR');

  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>;
}
