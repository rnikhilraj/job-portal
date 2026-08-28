'use client';

import { usePathname } from 'next/navigation';

/**
 * A short settle on route change so navigation is not a hard cut.
 *
 * Keyed on the pathname, which remounts the wrapper and replays the animation.
 * This is an enter transition, not a shared-element one — the native View
 * Transition API would give that, but it is still partially supported and
 * behind an experimental flag in Next, which is not a trade worth making here.
 *
 * Reduced motion collapses the duration to ~0 via the global rule, so the
 * content simply appears.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-enter">
      {children}
    </div>
  );
}
