import Link from 'next/link';

import { LogoutButton } from '@/components/logout-button';
import { MobileNav } from '@/components/mobile-nav';
import type { PublicUser } from '@/modules/users/user.constants';

const HR_LINKS = [
  { href: '/hr/jobs', label: 'My listings' },
  { href: '/hr/candidates', label: 'Candidate search' },
];

const CANDIDATE_LINKS = [
  { href: '/jobs', label: 'Browse jobs' },
  { href: '/applications', label: 'My applications' },
  { href: '/profile', label: 'Profile' },
];

/** Wordmark: the pipeline motif at its smallest, three nodes and a track. */
function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-sm text-[0.9375rem] font-semibold text-ink"
    >
      <span aria-hidden="true" className="flex items-center">
        <span className="h-1.5 w-1.5 rounded-full bg-petrol-600" />
        <span className="h-0.5 w-1.5 bg-petrol-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-petrol-500" />
        <span className="h-0.5 w-1.5 bg-mist-400" />
        <span className="h-1.5 w-1.5 rounded-full border border-mist-400 bg-white" />
      </span>
      <span className="font-display tracking-tight">Shortlist</span>
    </Link>
  );
}

export function SiteHeader({ user }: { user: PublicUser | null }) {
  const links = user?.role === 'HR' ? HR_LINKS : user ? CANDIDATE_LINKS : [];

  return (
    <header className="sticky top-0 z-40 border-b border-mist-300 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Wordmark />

        {/* Desktop navigation. Collapses into MobileNav below the md breakpoint. */}
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted
                transition-colors hover:bg-mist-200 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="flex items-center gap-2 text-sm">
                <span className="font-medium text-ink">{user.name}</span>
                <span
                  className="rounded-full bg-petrol-50 px-2 py-0.5 text-[0.6875rem]
                    font-semibold uppercase tracking-wide text-petrol-700"
                >
                  {user.role}
                </span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary btn-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto md:hidden">
          <MobileNav user={user} links={links} />
        </div>
      </div>
    </header>
  );
}
