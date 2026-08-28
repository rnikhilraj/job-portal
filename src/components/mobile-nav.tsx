'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LogoutButton } from '@/components/logout-button';
import type { PublicUser } from '@/modules/users/user.constants';

/**
 * Navigation below the md breakpoint: a disclosure panel rather than a
 * horizontally scrolling bar, so every destination stays reachable at 320px.
 *
 * Closes on route change, on Escape, and on a click outside — the three ways
 * someone actually expects a menu to go away.
 */
export function MobileNav({
  user,
  links,
}: {
  user: PublicUser | null;
  links: Array<{ href: string; label: string }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  /*
   * The panel remembers which route it was opened on, and "open" is derived by
   * comparing that to the current one. Navigating therefore closes it for free.
   *
   * The obvious alternative — an effect that calls setIsOpen(false) whenever
   * pathname changes — schedules a second render just to undo the first, which
   * is what react-hooks/set-state-in-effect exists to catch.
   */
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null);
  const isOpen = openedOnPath === pathname;

  const setIsOpen = useCallback(
    (open: boolean) => setOpenedOnPath(open ? pathname : null),
    [pathname],
  );

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isOpen, setIsOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
        className="btn-secondary btn-sm min-h-11 px-3"
      >
        <span aria-hidden="true" className="flex flex-col gap-[3px]">
          <span className="block h-0.5 w-4 bg-ink-soft" />
          <span className="block h-0.5 w-4 bg-ink-soft" />
          <span className="block h-0.5 w-4 bg-ink-soft" />
        </span>
        <span>Menu</span>
      </button>

      {isOpen ? (
        <div
          id="mobile-nav-panel"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-card border
            border-mist-300 bg-white p-2 shadow-card-hover"
        >
          {user ? (
            <div className="border-b border-mist-200 px-3 pb-3 pt-2">
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{user.email}</p>
              <span
                className="mt-2 inline-flex rounded-full bg-petrol-50 px-2 py-0.5
                  text-[0.6875rem] font-semibold uppercase tracking-wide text-petrol-700"
              >
                {user.role}
              </span>
            </div>
          ) : null}

          <nav aria-label="Main" className="flex flex-col py-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-ink-soft
                  hover:bg-mist-200 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-mist-200 p-2 pt-3">
            {user ? (
              <LogoutButton className="w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/login" className="btn-secondary w-full">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary w-full">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
